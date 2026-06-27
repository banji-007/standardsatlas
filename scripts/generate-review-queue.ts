/**
 * Generates data/review-queue.yaml from static analysis of all data files.
 * Bands each entity Low (concrete defect) or Medium (soft issue). High items are absent.
 * Never sets verified or modifies entity data. Run: pnpm generate-review-queue
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import { StandardSchema } from '../src/lib/schema';
import type { FaqEntry, VersionCandidate, ReviewQueueItem } from '../src/lib/schema';

const CONTENT_DIR = resolve('src/content/standards');
const DATA_DIR    = resolve('data');
const QUEUE_FILE  = resolve('data/review-queue.yaml');

const PCI_DOMAIN = 'pcisecuritystandards.org';

function srcDomain(url: string | null | undefined): string | null {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : null; }
  catch { return null; }
}

function standardSignals(s: Standard): ReviewQueueItem | null {
  const lows: string[] = [];
  const mediums: string[] = [];

  const d = srcDomain(s.source_url);
  if (!d || !d.endsWith(PCI_DOMAIN)) {
    lows.push(
      `source_url domain is '${d ?? 'missing'}'; expected '${PCI_DOMAIN}'. ` +
      `Action: update source_url to the official PCI SSC page. Found: ${s.source_url ?? '(none)'}`
    );
  }

  if (s.current_version) {
    if (!s.versions.some(v => v.version === s.current_version)) {
      const present = s.versions.map(v => v.version).join(', ') || '(none)';
      lows.push(
        `current_version '${s.current_version}' not found in versions array [${present}]. ` +
        `Action: update current_version or add the missing version entry. Source: ${s.source_url}`
      );
    }
    const curVer = s.versions.find(v => v.version === s.current_version);
    if (s.status === 'active' && curVer?.retired) {
      lows.push(
        `status is 'active' but current_version '${s.current_version}' has retired date ` +
        `${curVer.retired.toISOString().split('T')[0]}. ` +
        `Action: update status to 'retired' or remove the retired date. Source: ${s.source_url}`
      );
    }
  }

  if (s.status === 'retired' && !s.versions.some(v => v.retired)) {
    lows.push(
      `status is 'retired' but no version has a retired date. ` +
      `Action: add a retired date to the relevant version entry. Source: ${s.source_url}`
    );
  }

  if (s.status === 'sunset-scheduled') {
    if (!s.versions.some(v => v.retired && v.retired.getTime() > Date.now())) {
      lows.push(
        `status is 'sunset-scheduled' but no version has a future retired date. ` +
        `Action: add a future retired date or update status. Source: ${s.source_url}`
      );
    }
  }

  const docSlugs = s.documents.map(doc => doc.slug);
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const slug of docSlugs) {
    if (seen.has(slug)) dupes.push(slug);
    else seen.add(slug);
  }
  if (dupes.length > 0) {
    lows.push(
      `duplicate document slug(s) [${[...new Set(dupes)].join(', ')}]. ` +
      `Action: remove duplicate entries. Source: ${s.source_url}`
    );
  }

  if (!s.verified) {
    mediums.push(
      `verified is false; record needs manual review against the official source. ` +
      `Action: verify and set verified: true. Source: ${s.source_url}`
    );
  }

  if (!s.last_verified) {
    mediums.push(
      `last_verified is null; no record of when this entry was last reviewed. ` +
      `Action: set last_verified after the next manual review. Source: ${s.source_url}`
    );
  }

  if (lows.length === 0 && mediums.length === 0) return null;

  return {
    entity_type: 'standard',
    id: s.slug,
    band: lows.length > 0 ? 'low' : 'medium',
    reasons: [...lows, ...mediums],
  };
}

function faqSignals(faqs: FaqEntry[]): ReviewQueueItem[] {
  return faqs
    .filter(f => f.mapping_method === 'disambiguated' || f.mapping_method === 'inferred')
    .map(f => {
      const title = f.title.length > 70 ? f.title.slice(0, 70) + '...' : f.title;
      return {
        entity_type: 'faq' as const,
        id: String(f.number),
        band: 'medium' as const,
        reasons: [
          `FAQ #${f.number} '${title}' uses mapping_method '${f.mapping_method}'; ` +
          `standard assignment [${f.standards.join(', ') || 'none'}] may need review. ` +
          `Action: verify the standard mapping and update mapping_method to 'direct' if confirmed. ` +
          `Source: ${f.source_url}`
        ],
      };
    });
}

function candidateSignals(candidates: VersionCandidate[]): ReviewQueueItem[] {
  return candidates.map(c => ({
    entity_type: 'version-candidate' as const,
    id: c.slug,
    band: 'low' as const,
    reasons: c.reason === 'version-newer'
      ? [
          `Possible new version for ${c.standard_name}: document '${c.document_title}' suggests ` +
          `version ${c.detected_version} (current recorded: ${c.current_version ?? 'none'}). ` +
          `Action: verify on PCI SSC page and update versions array if confirmed. Source: ${c.source_url}`
        ]
      : [
          `Possible retirement/sunset for ${c.standard_name}: bulletin '${c.document_title}' ` +
          `contains retirement/sunset language. ` +
          `Action: verify on PCI SSC page and update status if confirmed. Source: ${c.source_url}`
        ],
  }));
}

function main() {
  const items: ReviewQueueItem[] = [];

  if (existsSync(CONTENT_DIR)) {
    for (const file of readdirSync(CONTENT_DIR).filter(f => f.endsWith('.yaml'))) {
      const raw = yaml.load(readFileSync(join(CONTENT_DIR, file), 'utf8')) as unknown;
      const result = StandardSchema.safeParse(raw);
      if (!result.success) continue; // invalid records are caught by pnpm validate
      const item = standardSignals(result.data);
      if (item) items.push(item);
    }
  }

  const faqPath = join(DATA_DIR, 'faqs.yaml');
  if (existsSync(faqPath)) {
    const raw = yaml.load(readFileSync(faqPath, 'utf8')) as { faqs?: FaqEntry[] } | null;
    items.push(...faqSignals(raw?.faqs ?? []));
  }

  const vcPath = join(DATA_DIR, 'version-candidates.yaml');
  if (existsSync(vcPath)) {
    const raw = yaml.load(readFileSync(vcPath, 'utf8')) as { candidates?: VersionCandidate[] } | null;
    items.push(...candidateSignals(raw?.candidates ?? []));
  }

  items.sort((a, b) => {
    if (a.band !== b.band) return a.band === 'low' ? -1 : 1;
    return a.entity_type.localeCompare(b.entity_type) || a.id.localeCompare(b.id);
  });

  const lowCount    = items.filter(i => i.band === 'low').length;
  const mediumCount = items.filter(i => i.band === 'medium').length;

  const output = {
    generated: new Date().toISOString(),
    low_count: lowCount,
    medium_count: mediumCount,
    items,
  };

  writeFileSync(QUEUE_FILE, yaml.dump(output, { lineWidth: 120, quotingType: '"' }));
  console.log(`review-queue: ${lowCount} low, ${mediumCount} medium. Wrote data/review-queue.yaml`);
}

main();
