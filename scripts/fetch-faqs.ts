/**
 * Fetches the PCI SSC FAQ RSS feed (?type=faq) and emits data/faqs.yaml.
 * Ingests number, title, link, and updated date only -- never the answer body.
 * Run with: pnpm fetch-faqs
 * Dry-run (no writes): pnpm fetch-faqs --dry-run
 */

import { XMLParser } from 'fast-xml-parser';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { parseFaqCategories, resolveFaq, type FaqMappingMethod } from '../src/lib/faq';

const FEED_URL  = 'https://www.pcisecuritystandards.org/rssfeed/?type=faq';
const FAQ_FILE  = resolve('data/faqs.yaml');
const TRIAGE_FILE = resolve('data/faq-triage.md');
const DRY_RUN   = process.argv.includes('--dry-run');

interface FaqEntry {
  number: number;
  title: string;
  updated: string | null;
  standards: string[];
  mapping_method: FaqMappingMethod;
  source_url: string;
  verified: boolean;
}

async function fetchFeed(): Promise<Record<string, unknown>[]> {
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'securitystandardsmap-bot/1.0 (https://securitystandardsmap.org)' },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const parser = new XMLParser({ isArray: (name) => name === 'item' || name === 'category' });
  return (parser.parse(xml)?.rss?.channel?.item ?? []) as Record<string, unknown>[];
}

function loadExisting(): Map<number, FaqEntry> {
  if (!existsSync(FAQ_FILE)) return new Map();
  const data = yaml.load(readFileSync(FAQ_FILE, 'utf8')) as { faqs?: FaqEntry[] } | null;
  return new Map((data?.faqs ?? []).map(f => [f.number, f]));
}

function sanitize(obj: unknown): unknown {
  if (typeof obj === 'string') return obj.trim();
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, sanitize(v)]),
    );
  }
  return obj;
}

function writeTriage(entries: FaqEntry[]) {
  const excluded = entries.filter(f => f.mapping_method === 'excluded');
  const general  = entries.filter(f => f.mapping_method === 'general');

  const lines = [
    '# FAQ Triage',
    '',
    'Entries where no standard was mapped. Review and either:',
    '- Set `mapping_method: general` + `verified: true` to surface in the General FAQs view.',
    '- Set `mapping_method: excluded` + `verified: true` to permanently suppress.',
    '- Assign to a specific `standards: [slug]` + appropriate `mapping_method` + `verified: true`.',
    '',
    `## General (${general.length}) — shown in /faqs/, may include some admin FAQs`,
    '',
    ...general.map(f => `- **#${f.number}** ${f.title}  \n  <${f.source_url}>`),
    '',
    `## Excluded (${excluded.length}) — program/admin, not shown`,
    '',
    ...excluded.map(f => `- **#${f.number}** ${f.title}  \n  <${f.source_url}>`),
  ];

  if (!DRY_RUN) {
    writeFileSync(TRIAGE_FILE, lines.join('\n') + '\n');
  }
}

async function main() {
  console.log(`Fetching ${FEED_URL} ...`);
  const items = await fetchFeed();
  console.log(`Parsed ${items.length} FAQ items`);

  const existing = loadExisting();
  const incoming = new Map<number, FaqEntry>();

  for (const item of items) {
    const num = parseInt(String(item['articleNumber'] ?? ''), 10);
    if (!num || isNaN(num)) continue;

    const title = String(item['title'] ?? '').trim();
    const cats  = parseFaqCategories(item['category'] as string | string[] | undefined);
    const { standards, mapping_method } = resolveFaq(cats, title);
    const updated = (item['atom:updated'] as string | undefined) ?? null;

    incoming.set(num, {
      number: num,
      title,
      updated,
      standards,
      mapping_method,
      source_url: `https://www.pcisecuritystandards.org/faqs/${num}/`,
      verified: false,
    });
  }

  const added: number[]   = [];
  const changed: number[] = [];
  for (const [num, entry] of incoming) {
    const prev = existing.get(num);
    if (!prev) added.push(num);
    else if (prev.updated !== entry.updated) changed.push(num);
  }

  const merged: FaqEntry[] = [...incoming.values()].map(entry => {
    const prev = existing.get(entry.number);
    if (prev?.verified) {
      // Preserve the maintainer's mapping decision on verified entries
      return { ...entry, verified: true, mapping_method: prev.mapping_method, standards: prev.standards };
    }
    return entry;
  });
  merged.sort((a, b) => a.number - b.number);

  console.log(`\nChanges vs previous: +${added.length} new, ~${changed.length} updated`);
  if (added.length)   console.log(`  New:     ${added.join(', ')}`);
  if (changed.length) console.log(`  Updated: ${changed.slice(0, 10).join(', ')}${changed.length > 10 ? ` ... (${changed.length} total)` : ''}`);

  // Method breakdown
  const byMethod: Record<string, number> = {};
  for (const f of merged) byMethod[f.mapping_method] = (byMethod[f.mapping_method] ?? 0) + 1;
  console.log('\nMapping methods:', Object.entries(byMethod).map(([k, v]) => `${k}:${v}`).join(', '));

  writeTriage(merged);

  if (!DRY_RUN) {
    writeFileSync(FAQ_FILE, yaml.dump(sanitize({ faqs: merged }), { lineWidth: 120, quotingType: '"' }));
    console.log(`\nWrote ${merged.length} entries to data/faqs.yaml`);
    console.log(`Wrote triage to data/faq-triage.md`);
  } else {
    const noStd = merged.filter(f => f.standards.length === 0).length;
    console.log(`\nDry run; would write ${merged.length} entries (${noStd} unmapped)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
