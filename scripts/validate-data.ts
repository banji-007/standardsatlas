/**
 * Validates all data files against the Zod schemas and asserts
 * status/date consistency. Warns on mismatches; exits non-zero on errors.
 * Run with: pnpm validate
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import { StandardSchema, RelationshipSchema, ExternalBodySchema, FaqsFileSchema, VersionCandidatesFileSchema, ReviewQueueFileSchema } from '../src/lib/schema';
import { ZodError } from 'zod';

const CONTENT_DIR = resolve('src/content/standards');
const DATA_DIR = resolve('data');

let errors = 0;
let warnings = 0;

function err(msg: string) {
  console.error(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg: string) {
  console.warn(`  WARN:  ${msg}`);
  warnings++;
}

function validateStandardFile(path: string, filename: string) {
  const raw = yaml.load(readFileSync(path, 'utf8')) as unknown;
  const result = StandardSchema.safeParse(raw);

  if (!result.success) {
    for (const issue of result.error.issues) {
      err(`${filename}: ${issue.path.join('.')}: ${issue.message}`);
    }
    return;
  }

  const s = result.data;
  const fileSlug = filename.replace(/\.ya?ml$/, '');

  // Slug must match filename
  if (s.slug !== fileSlug) {
    err(`${filename}: slug "${s.slug}" does not match filename "${fileSlug}"`);
  }

  // Status/date consistency
  const hasRetiredVersion = s.versions.some(v => v.retired !== null);
  const currentVersionEntry = s.current_version
    ? s.versions.find(v => v.version === s.current_version)
    : null;

  if (s.status === 'retired' && !hasRetiredVersion) {
    warn(`${filename}: status is "retired" but no version has a retired date`);
  }

  if (s.status === 'active' && currentVersionEntry?.retired) {
    err(`${filename}: status is "active" but current_version "${s.current_version}" has a retired date`);
  }

  if (s.status === 'sunset-scheduled') {
    const hasFutureRetirement = s.versions.some(
      v => v.retired && v.retired.getTime() > Date.now(),
    );
    if (!hasFutureRetirement) {
      warn(`${filename}: status is "sunset-scheduled" but no version has a future retired date`);
    }
  }

  // verified: false at top level means the whole record needs review
  if (!s.verified) {
    warn(`${filename}: top-level verified: false; needs manual review`);
  }

  const unverifiedVersions = s.versions.filter(v => !v.verified).length;
  const unverifiedDocs = s.documents.filter(d => !d.verified).length;

  if (unverifiedVersions > 0) {
    warn(`${filename}: ${unverifiedVersions} unverified version(s)`);
  }
  if (unverifiedDocs > 0) {
    warn(`${filename}: ${unverifiedDocs} unverified document(s)`);
  }
}

function validateRelationships(path: string) {
  if (!existsSync(path)) return;
  const parsed = yaml.load(readFileSync(path, 'utf8')) as { relationships?: unknown[] } | null;
  const raw = parsed?.relationships;

  if (!Array.isArray(raw)) {
    err('relationships.yaml: expected "relationships" array at root');
    return;
  }

  const standardSlugs = existsSync(CONTENT_DIR)
    ? new Set(readdirSync(CONTENT_DIR).map(f => f.replace(/\.ya?ml$/, '')))
    : new Set<string>();

  for (const [i, item] of raw.entries()) {
    const result = RelationshipSchema.safeParse(item);
    if (!result.success) {
      err(`relationships.yaml[${i}]: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }

    const r = result.data;
    if (!standardSlugs.has(r.from)) {
      warn(`relationships.yaml: edge "${r.id}" from "${r.from}"; no matching standard file`);
    }
    const targets = Array.isArray(r.to) ? r.to : [r.to];
    for (const t of targets) {
      if (!standardSlugs.has(t)) {
        warn(`relationships.yaml: edge "${r.id}" to "${t}"; no matching standard file`);
      }
    }
  }
}

function validateExternalBodies(path: string) {
  if (!existsSync(path)) return;
  const parsed = yaml.load(readFileSync(path, 'utf8')) as { external_bodies?: unknown[] } | null;
  const raw = parsed?.external_bodies;

  if (!Array.isArray(raw)) {
    err('external-bodies.yaml: expected "external_bodies" array at root');
    return;
  }

  for (const [i, item] of raw.entries()) {
    const result = ExternalBodySchema.safeParse(item);
    if (!result.success) {
      err(`external-bodies.yaml[${i}]: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
  }
}

function validateVersionCandidates(path: string) {
  if (!existsSync(path)) return;
  const data = yaml.load(readFileSync(path, 'utf8')) as unknown;
  const result = VersionCandidatesFileSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      err(`version-candidates.yaml: ${issue.path.join('.')}: ${issue.message}`);
    }
    return;
  }
  process.stdout.write(`  version-candidates.yaml: ${result.data.candidates.length} candidate(s) ✓\n`);
}

function validateFaqs(path: string) {
  if (!existsSync(path)) return;
  const data = yaml.load(readFileSync(path, 'utf8')) as unknown;
  const result = FaqsFileSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      err(`faqs.yaml: ${issue.path.join('.')}: ${issue.message}`);
    }
    return;
  }
  const { faqs } = result.data;
  const unverified = faqs.filter(f => !f.verified).length;
  const noStandard = faqs.filter(f => f.standards.length === 0).length;
  if (unverified > 0) warn(`faqs.yaml: ${unverified} unverified FAQ entries`);
  if (noStandard > 0) warn(`faqs.yaml: ${noStandard} FAQ entries with no standard mapped`);
  process.stdout.write(`  faqs.yaml: ${faqs.length} entries ✓\n`);
}

function validateReviewQueue(path: string) {
  if (!existsSync(path)) return;
  const data = yaml.load(readFileSync(path, 'utf8')) as unknown;
  const result = ReviewQueueFileSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      err(`review-queue.yaml: ${issue.path.join('.')}: ${issue.message}`);
    }
    return;
  }
  const { low_count, medium_count } = result.data;
  process.stdout.write(`  review-queue.yaml: ${low_count} low, ${medium_count} medium ✓\n`);
}

// Run
console.log('Validating standards …');
if (existsSync(CONTENT_DIR)) {
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    process.stdout.write(`  ${file} `);
    validateStandardFile(join(CONTENT_DIR, file), file);
    if (errors === 0) process.stdout.write('✓\n');
    else process.stdout.write('\n');
  }
  console.log(`  ${files.length} files checked`);
} else {
  console.log('  No standards directory found');
}

console.log('\nValidating relationships …');
validateRelationships(join(DATA_DIR, 'relationships.yaml'));

console.log('\nValidating external bodies …');
validateExternalBodies(join(DATA_DIR, 'external-bodies.yaml'));

console.log('\nValidating FAQs …');
validateFaqs(join(DATA_DIR, 'faqs.yaml'));

console.log('\nValidating version candidates …');
validateVersionCandidates(join(DATA_DIR, 'version-candidates.yaml'));

console.log('\nValidating review queue …');
validateReviewQueue(join(DATA_DIR, 'review-queue.yaml'));

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
if (errors > 0) process.exit(1);
