import { getCollection } from 'astro:content';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import type { Standard, Relationship, FaqEntry } from './schema';
import type { AppData } from './appTypes';

export async function getAppData(): Promise<AppData> {
  const standards = await getCollection('standards');

  let relationships: Relationship[] = [];
  try {
    const raw = yaml.load(readFileSync(resolve('data/relationships.yaml'), 'utf8')) as { relationships?: Relationship[] } | null;
    relationships = raw?.relationships ?? [];
  } catch { /* relationships file may not exist */ }

  let allFaqs: FaqEntry[] = [];
  try {
    const rawFaqs = yaml.load(readFileSync(resolve('data/faqs.yaml'), 'utf8')) as { faqs?: FaqEntry[] } | null;
    allFaqs = rawFaqs?.faqs ?? [];
  } catch { /* faqs file may not exist yet */ }

  const faqsByStandard: Record<string, FaqEntry[]> = {};
  for (const faq of allFaqs) {
    for (const slug of faq.standards ?? []) {
      (faqsByStandard[slug] ??= []).push(faq);
    }
  }

  const appData: AppData = {
    standards: standards.map(entry => {
      const d = entry.data as Standard;
      const faqDocs = (faqsByStandard[entry.id] ?? []).map(faq => ({
        slug: `faq-${faq.number}`,
        title: faq.title,
        type: 'faq' as const,
        published: faq.updated instanceof Date
          ? faq.updated.toISOString().slice(0, 10)
          : String(faq.updated).slice(0, 10),
        applies_to_version: null,
        source_url: faq.source_url ?? null,
        verified: faq.verified,
      }));
      return {
        slug: entry.id,
        name: d.name,
        status: d.status,
        source_url: d.source_url,
        verified: d.verified,
        last_verified: d.last_verified?.toISOString().slice(0, 10) ?? null,
        current_version: d.current_version ?? null,
        notes: d.notes,
        versions: d.versions.map(v => ({
          version: v.version,
          published: v.published?.toISOString().slice(0, 10) ?? null,
          retired: v.retired?.toISOString().slice(0, 10) ?? null,
          status: v.status,
          source_url: v.source_url ?? null,
          verified: v.verified,
        })),
        documents: [
          ...d.documents.map(doc => ({
            slug: doc.slug,
            title: doc.title,
            type: doc.type,
            published: doc.published?.toISOString().slice(0, 10) ?? null,
            applies_to_version: doc.applies_to_version ?? null,
            source_url: doc.source_url ?? null,
            verified: doc.verified,
          })),
          ...faqDocs,
        ],
      };
    }),
    relationships: relationships.map(r => ({
      id: r.id,
      type: r.type,
      from: r.from,
      to: r.to,
      state: r.state,
      effective_date: r.effective_date?.toISOString().slice(0, 10) ?? null,
      description: r.description ?? null,
      source_url: r.source_url,
      verified: r.verified,
    })),
    faqs: allFaqs
      .filter(faq => faq.mapping_method !== 'excluded')
      .map(faq => ({
        number: faq.number,
        title: faq.title,
        updated: faq.updated,
        standards: faq.standards ?? [],
        mapping_method: faq.mapping_method,
        source_url: faq.source_url,
      })),
    lastVerified: standards
      .flatMap(s => (s.data as Standard).last_verified ? [(s.data as Standard).last_verified!] : [])
      .sort((a, b) => b.getTime() - a.getTime())[0]
      ?.toISOString().slice(0, 10) ?? '',
  };

  return appData;
}
