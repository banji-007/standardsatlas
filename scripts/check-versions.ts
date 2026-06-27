/**
 * Detects potential new standard versions from ingested documents.
 * Writes data/version-candidates.yaml and (when GITHUB_TOKEN is set) opens/updates
 * GitHub issues per candidate. Never modifies any standard's versions, current_version,
 * status, or retired fields.
 * Run: pnpm check-versions
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import type { Standard, VersionCandidate } from '../src/lib/schema';
import { inferVersion } from '../src/lib/rss';

const CONTENT_DIR  = resolve('src/content/standards');
const CANDIDATES_FILE = resolve('data/version-candidates.yaml');
const DRY_RUN = process.argv.includes('--dry-run');

const RETIREMENT_PATTERN = /\bretir(e|ed|ement|ing)\b|\bsunset\b|\bend[\s-]of[\s-]life\b|\bdeprecated?\b/i;

function semverParts(v: string): number[] {
  return v.split('.').map(n => parseInt(n, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const pa = semverParts(a);
  const pb = semverParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function docVersion(doc: { slug: string; title: string }): string | null {
  return inferVersion(doc.slug) ?? inferVersion(doc.title);
}

function detectCandidates(standard: Standard): VersionCandidate[] {
  const results: VersionCandidate[] = [];
  const cur = standard.current_version ?? null;

  // Check standard-type documents for a version newer than current_version
  const standardDocs = standard.documents.filter(d => d.type === 'standard');
  for (const doc of standardDocs) {
    const detected = docVersion(doc);
    if (!detected) continue;

    const isNewer = !cur || compareVersions(detected, cur) > 0;
    const isDifferent = detected !== cur;
    if (isDifferent && isNewer) {
      results.push({
        slug: standard.slug,
        standard_name: standard.name,
        current_version: cur,
        detected_version: detected,
        detected_date: doc.published ? doc.published.toISOString().split('T')[0]! : null,
        document_slug: doc.slug,
        document_title: doc.title,
        source_url: doc.source_url ?? standard.source_url,
        reason: 'version-newer',
      });
    }
  }

  // Deduplicate: keep only the highest detected version per standard
  const byStandard = new Map<string, VersionCandidate>();
  for (const c of results) {
    const prev = byStandard.get(c.slug);
    if (!prev || (c.detected_version && prev.detected_version && compareVersions(c.detected_version, prev.detected_version) > 0)) {
      byStandard.set(c.slug, c);
    }
  }
  const deduped = [...byStandard.values()];

  // Check bulletin-type documents for retirement/sunset language
  const bulletins = standard.documents.filter(d => d.type === 'bulletin');
  for (const doc of bulletins) {
    if (RETIREMENT_PATTERN.test(doc.title)) {
      deduped.push({
        slug: standard.slug,
        standard_name: standard.name,
        current_version: cur,
        detected_version: null,
        detected_date: doc.published ? doc.published.toISOString().split('T')[0]! : null,
        document_slug: doc.slug,
        document_title: doc.title,
        source_url: doc.source_url ?? standard.source_url,
        reason: 'bulletin-retirement',
      });
    }
  }

  return deduped;
}

async function ensureGitHubLabel(repo: string, token: string): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${repo}/labels/version-candidate`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'securitystandardsmap-bot' },
  });
  if (res.status === 404) {
    await fetch(`https://api.github.com/repos/${repo}/labels`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json', 'User-Agent': 'securitystandardsmap-bot' },
      body: JSON.stringify({ name: 'version-candidate', color: 'e4e669', description: 'Possible new standard version detected by RSS pipeline' }),
    });
  }
}

async function openOrUpdateIssue(repo: string, token: string, candidate: VersionCandidate): Promise<void> {
  const title = candidate.reason === 'version-newer'
    ? `Possible new version: ${candidate.standard_name} ${candidate.detected_version}`
    : `Possible retirement/sunset: ${candidate.standard_name}`;

  const body = [
    `**Standard:** ${candidate.standard_name} (\`${candidate.slug}\`)`,
    `**Current recorded version:** ${candidate.current_version ?? 'none'}`,
    candidate.detected_version ? `**Detected version:** ${candidate.detected_version}` : '',
    `**Signal:** ${candidate.reason === 'version-newer' ? 'A standard-type document with a higher version was found in the RSS feed.' : 'A bulletin document with retirement/sunset language was found in the RSS feed.'}`,
    `**Triggering document:** ${candidate.document_title}`,
    `**Document link:** ${candidate.source_url}`,
    `**Detected date:** ${candidate.detected_date ?? 'unknown'}`,
    '',
    '**Action required:** Verify on the official PCI SSC page, then update the standard YAML manually. Do not auto-promote -- all version promotions require human review.',
    '',
    '*Opened automatically by the RSS pipeline version-candidate check.*',
  ].filter(Boolean).join('\n');

  const listUrl = `https://api.github.com/repos/${repo}/issues?state=open&labels=version-candidate&per_page=100`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'securitystandardsmap-bot' },
  });
  const open = (await listRes.json()) as { number: number; title: string }[];

  const existing = open.find(i => i.title === title);
  if (existing) {
    await fetch(`https://api.github.com/repos/${repo}/issues/${existing.number}`, {
      method: 'PATCH',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json', 'User-Agent': 'securitystandardsmap-bot' },
      body: JSON.stringify({ body }),
    });
    console.log(`    GH: updated issue #${existing.number} "${title}"`);
  } else {
    const createRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json', 'User-Agent': 'securitystandardsmap-bot' },
      body: JSON.stringify({ title, body, labels: ['version-candidate'] }),
    });
    const created = (await createRes.json()) as { number: number };
    console.log(`    GH: opened issue #${created.number} "${title}"`);
  }
}

async function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.log('No standards directory; nothing to check.');
    return;
  }

  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.yaml'));
  const candidates: VersionCandidate[] = [];

  for (const file of files) {
    const raw = yaml.load(readFileSync(join(CONTENT_DIR, file), 'utf8')) as Standard;
    const found = detectCandidates(raw);
    candidates.push(...found);
  }

  candidates.sort((a, b) => a.slug.localeCompare(b.slug));

  const output = {
    generated: new Date().toISOString(),
    candidates,
  };

  if (!DRY_RUN) {
    writeFileSync(CANDIDATES_FILE, yaml.dump(output, { lineWidth: 120, quotingType: '"' }));
  }

  if (candidates.length === 0) {
    console.log('check-versions: no candidates detected.');
    return;
  }

  console.log(`\ncheck-versions: ${candidates.length} candidate(s) detected:`);
  for (const c of candidates) {
    if (c.reason === 'version-newer') {
      console.log(`  [version-candidate] ${c.slug}: recorded=${c.current_version ?? 'none'}, detected=${c.detected_version} via "${c.document_title}"`);
    } else {
      console.log(`  [bulletin-retirement] ${c.slug}: bulletin with retirement language: "${c.document_title}"`);
    }
  }

  if (!DRY_RUN) {
    console.log(`\nWrote ${candidates.length} candidate(s) to data/version-candidates.yaml`);
  }

  const repo  = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (repo && token && !DRY_RUN) {
    console.log('\nOpening/updating GitHub issues...');
    await ensureGitHubLabel(repo, token);
    for (const c of candidates) {
      await openOrUpdateIssue(repo, token, c);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
