/**
 * Fetches the PCI SSC document RSS feed and emits draft YAML entries for all
 * in-scope standards. Existing manually-verified fields are preserved.
 * Run with: pnpm fetch-rss
 * Dry-run (no writes): pnpm fetch-rss --dry-run
 */

import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import {
  CATEGORY_TO_SLUG,
  resolveStandardSlug,
  inferVersion,
  normalizeDocType,
  CROSS_STANDARD_DOCS,
} from '../src/lib/rss';

const FEED_URL = 'https://www.pcisecuritystandards.org/rssfeed/?type=document';
const CONTENT_DIR = resolve('src/content/standards');
const DRY_RUN = process.argv.includes('--dry-run');

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  category?: string | string[];
  guid?: string;
}

interface DraftDocument {
  slug: string;
  title: string;
  type: string;
  published: string | null;
  applies_to_version: string | null;
  source_url: string;
  verified: boolean;
}

async function fetchFeed(): Promise<RssItem[]> {
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'securitystandardsmap-bot/1.0 (https://securitystandardsmap.org)' },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const parser = new XMLParser({ isArray: (name) => name === 'item' || name === 'category' });
  const parsed = parser.parse(xml);
  return (parsed?.rss?.channel?.item ?? []) as RssItem[];
}

function extractSlugFromLink(link: string): string {
  try {
    const url = new URL(link.trim());
    // PCI SSC links use ?document=<slug> query param; prefer that over path-based slugs
    const docParam = url.searchParams.get('document');
    if (docParam) return docParam;
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? link;
  } catch {
    return link;
  }
}

function parseCategories(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(c => c.trim()).filter(Boolean);
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  try {
    return new Date(raw).toISOString().split('T')[0]!;
  } catch {
    return null;
  }
}

function loadExistingStandard(slug: string): Record<string, unknown> | null {
  const path = join(CONTENT_DIR, `${slug}.yaml`);
  if (!existsSync(path)) return null;
  try {
    return yaml.load(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mergeDocuments(
  existing: DraftDocument[],
  incoming: DraftDocument[],
): DraftDocument[] {
  const bySlug = new Map(existing.map(d => [d.slug, d]));
  for (const doc of incoming) {
    if (!bySlug.has(doc.slug)) {
      bySlug.set(doc.slug, doc);
    }
    // Never overwrite verified entries
  }
  const toStr = (d: string | Date | null): string => {
    if (!d) return '';
    if (d instanceof Date) return d.toISOString().split('T')[0]!;
    return d;
  };
  return Array.from(bySlug.values()).sort((a, b) =>
    toStr(b.published as string | Date | null).localeCompare(
      toStr(a.published as string | Date | null),
    ),
  );
}

function sanitize(obj: unknown): unknown {
  if (obj instanceof Date) return obj.toISOString().split('T')[0];
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)]),
    );
  }
  return obj;
}

function dumpYaml(obj: unknown): string {
  return yaml.dump(sanitize(obj), { lineWidth: 120, quotingType: '"' });
}

async function main() {
  console.log(`Fetching ${FEED_URL} …`);
  const items = await fetchFeed();
  console.log(`Parsed ${items.length} items`);

  const byStandard = new Map<string, DraftDocument[]>();

  for (const item of items) {
    const categories = parseCategories(item.category);
    const standardSlug = resolveStandardSlug(categories, item.title);
    const docSlug = extractSlugFromLink(item.link);
    const crossSlugs = CROSS_STANDARD_DOCS[docSlug];

    if (!standardSlug && !crossSlugs) continue;

    const version = inferVersion(docSlug) ?? inferVersion(item.title);
    const docType = normalizeDocType(item.description ?? '');
    const published = parseDate(item.pubDate);

    const doc: DraftDocument = {
      slug: docSlug,
      title: item.title.trim(),
      type: docType,
      published,
      applies_to_version: version,
      source_url: item.link,
      verified: false,
    };

    if (standardSlug) {
      if (!byStandard.has(standardSlug)) byStandard.set(standardSlug, []);
      byStandard.get(standardSlug)!.push(doc);
    }

    if (crossSlugs) {
      for (const slug of crossSlugs) {
        if (slug === standardSlug) continue;
        if (!byStandard.has(slug)) byStandard.set(slug, []);
        byStandard.get(slug)!.push(doc);
      }
    }
  }

  console.log(`Documents mapped to ${byStandard.size} standards`);

  if (!DRY_RUN) {
    mkdirSync(CONTENT_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;

  for (const [slug, docs] of byStandard) {
    const existing = loadExistingStandard(slug);
    const existingDocs = (existing?.documents ?? []) as DraftDocument[];
    const merged = mergeDocuments(existingDocs, docs);

    if (existing) {
      const existingDocSlugs = new Set(existingDocs.map(d => d.slug));
      const hasNew = docs.some(d => !existingDocSlugs.has(d.slug));
      if (!hasNew) continue;

      const updated_standard = { ...existing, documents: merged };
      if (!DRY_RUN) {
        writeFileSync(join(CONTENT_DIR, `${slug}.yaml`), dumpYaml(updated_standard));
      }
      console.log(`  Updated: ${slug} (+${docs.filter(d => !existingDocSlugs.has(d.slug)).length} docs)`);
      updated++;
    } else {
      // A new standard slug arrived in the feed with no matching YAML.
      // Creating a stub here would write a guessed source_url, which violates
      // the sourced-or-it-does-not-ship rule. Flag for manual creation instead.
      console.warn(`  NEW STANDARD (manual action needed): "${slug}" has no YAML in content/standards/. Create src/content/standards/${slug}.yaml with a verified source_url, then re-run.`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}${DRY_RUN ? ' (dry run, no files written)' : ''}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
