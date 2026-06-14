import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import type { Standard, Relationship } from '../src/lib/schema';

const CONTENT_DIR = resolve('src/content/standards');
const DATA_DIR = resolve('data');
const TIMEOUT_MS = 12000;
const CONCURRENCY = 8;

const urls = new Map<string, string>();

function collect(url: string | null | undefined, context: string) {
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
  const raw = yaml.load(readFileSync(relPath, 'utf8')) as { relationships?: Relationship[] } | null;
  for (const r of raw?.relationships ?? []) collect(r.source_url, `relationships[${r.id}]`);
}

async function checkUrl(url: string): Promise<{ ok: boolean; status: number | string; redirected: boolean }> {
  const opts = (method: string) => ({
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'securitystandardsmap-linkcheck/1.0' },
    redirect: 'follow' as const,
  });
  try {
    let res = await fetch(url, opts('HEAD'));
    if (res.status === 405) res = await fetch(url, opts('GET'));
    return { ok: res.ok, status: res.status, redirected: res.redirected };
  } catch {
    return { ok: false, status: 'timeout/error', redirected: false };
  }
}

async function run() {
  const entries = [...urls.entries()];
  console.log(`Checking ${entries.length} source URLs (concurrency ${CONCURRENCY})...`);

  const broken: { url: string; context: string; status: number | string }[] = [];
  const redirected: { url: string; context: string }[] = [];
  let checked = 0;

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ([url, context]) => {
        const result = await checkUrl(url);
        checked++;
        if (!result.ok) {
          process.stdout.write(`  FAIL  [${result.status}] ${url}  (${context})\n`);
        } else if (result.redirected) {
          process.stdout.write(`  REDIR [${result.status}] ${url}  (${context})\n`);
        }
        return { url, context, ...result };
      }),
    );
    broken.push(...results.filter(r => !r.ok).map(r => ({ url: r.url, context: r.context, status: r.status })));
    redirected.push(...results.filter(r => r.ok && r.redirected).map(r => ({ url: r.url, context: r.context })));
  }

  console.log(`\n${checked} URLs checked. ${broken.length} broken, ${redirected.length} redirected.`);

  if (redirected.length > 0) {
    console.warn('\nRedirected URLs (consider updating to canonical form):');
    for (const r of redirected) console.warn(`  ${r.url}  (${r.context})`);
  }

  if (broken.length > 0) {
    console.error('\nBroken source URLs:');
    for (const b of broken) console.error(`  [${b.status}] ${b.url}  (${b.context})`);
    process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
