import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import type { Standard, Relationship } from '../src/lib/schema';

const CONTENT_DIR = resolve('src/content/standards');
const DATA_DIR = resolve('data');
const TIMEOUT_MS = 12000;
const CONCURRENCY = 8;

const urls = new Map<string, string>();

function collect(url: string, context: string) {
  if (url && !urls.has(url)) urls.set(url, context);
}

if (existsSync(CONTENT_DIR)) {
  for (const file of readdirSync(CONTENT_DIR).filter(f => f.endsWith('.yaml'))) {
    const data = yaml.load(readFileSync(join(CONTENT_DIR, file), 'utf8')) as Standard;
    collect(data.source_url, `${file}[standard]`);
    for (const v of data.versions ?? []) collect(v.source_url, `${file}[v${v.version}]`);
    for (const d of data.documents ?? []) collect(d.source_url, `${file}[doc:${d.slug}]`);
  }
}

const relPath = join(DATA_DIR, 'relationships.yaml');
if (existsSync(relPath)) {
  const rels = yaml.load(readFileSync(relPath, 'utf8')) as Relationship[];
  for (const r of rels ?? []) collect(r.source_url, `relationships[${r.id}]`);
}

async function checkUrl(url: string): Promise<{ ok: boolean; status: number | string }> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'securitystandardsmap-linkcheck/1.0' },
      redirect: 'follow',
    });
    return { ok: res.ok || res.status === 405, status: res.status };
  } catch {
    return { ok: false, status: 'timeout/error' };
  }
}

async function run() {
  const entries = [...urls.entries()];
  console.log(`Checking ${entries.length} source URLs (concurrency ${CONCURRENCY})...`);

  const broken: { url: string; context: string; status: number | string }[] = [];
  let checked = 0;

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ([url, context]) => {
        const result = await checkUrl(url);
        checked++;
        if (!result.ok) {
          process.stdout.write(`  FAIL [${result.status}] ${url} (${context})\n`);
        }
        return { url, context, ...result };
      }),
    );
    broken.push(...results.filter(r => !r.ok).map(r => ({ url: r.url, context: r.context, status: r.status })));
  }

  console.log(`\n${checked} URLs checked. ${broken.length} broken.`);
  if (broken.length > 0) {
    console.error('\nBroken source URLs:');
    for (const b of broken) console.error(`  [${b.status}] ${b.url}  (${b.context})`);
    process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
