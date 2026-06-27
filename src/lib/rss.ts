// Exact category names as they appear in the PCI SSC RSS feed
export const CATEGORY_TO_SLUG: Record<string, string> = {
  'PCI DSS': 'pci-dss',
  'SAQ': 'pci-dss',          // SAQs are PCI DSS documents
  'P2PE': 'p2pe',
  'PIN': 'pin-security',
  'MPoC': 'mpoc',
  'SPoC': 'spoc',
  'CPoC': 'cpoc',
  'TSP': 'tsp',
  // Ambiguous categories; resolved by title in resolveStandardSlug()
  // 'Software Security': -> secure-software or secure-slc
  // 'PTS': -> pts-poi or pts-hsm
  // '3DS': -> 3ds-core or 3ds-sdk
  // 'Card Production': -> cpp-logical or cpp-physical
  // 'PA-DSS\\PA-QSA (Archived)': -> pa-dss
};

const EXCLUDED_CATEGORIES = new Set(['Programs and Certification', 'Case Study', 'Guidance Document']);

// Documents that belong to more than one standard regardless of RSS category routing.
// The RSS pipeline uses this to push a doc to every listed standard, not just the primary one.
// Covers: (a) CPP shared-program docs that PCI SSC dual-lists under both Card Production and
// Programs, and (b) programs-only docs (req_pol, code_of_prof_resp) that would otherwise be
// dropped by EXCLUDED_CATEGORIES.
export const CROSS_STANDARD_DOCS: Record<string, string[]> = {
  cpsa_qual:         ['cpp-logical', 'cpp-physical'],
  cpsa_prog_guide:   ['cpp-logical', 'cpp-physical'],
  req_pol:           ['cpp-logical', 'cpp-physical'],
  code_of_prof_resp: ['cpp-logical', 'cpp-physical'],
};

// Title keywords that distinguish within ambiguous categories
const TITLE_DISAMBIGUATORS: [RegExp, string][] = [
  [/secure\s+slc|software\s+lifecycle/i, 'secure-slc'],
  [/secure\s+software/i, 'secure-software'],
  [/hardware\s+security\s+module|hsm/i, 'pts-hsm'],
  [/point\s+of\s+interaction|poi\b/i, 'pts-poi'],
  [/\bsdk\b/i, '3ds-sdk'],
  [/3ds\s+core|three[-\s]?domain/i, '3ds-core'],
  [/physical/i, 'cpp-physical'],
  [/logical/i, 'cpp-logical'],
  [/card\s+production/i, 'cpp-logical'],  // fallback for unambiguous card production
];

export function resolveStandardSlug(categories: string[], title = ''): string | null {
  // Exclude documents whose only categories are out-of-scope
  if (categories.every(c => EXCLUDED_CATEGORIES.has(c) || !c)) return null;
  if (categories.includes('Programs and Certification') && categories.length === 1) return null;

  // Exact match first
  for (const c of categories) {
    if (CATEGORY_TO_SLUG[c]) return CATEGORY_TO_SLUG[c]!;
    // Handle the archived PA-DSS category
    if (c.startsWith('PA-DSS')) return 'pa-dss';
  }

  // Disambiguate by title for categories not in the direct map
  if (categories.some(c => ['Software Security', 'PTS', '3DS', 'Card Production'].includes(c))) {
    for (const [pattern, slug] of TITLE_DISAMBIGUATORS) {
      if (pattern.test(title)) return slug;
    }
    // Fallback: pick the primary standard in the family
    if (categories.includes('Software Security')) return 'secure-software';
    if (categories.includes('PTS')) return 'pts-poi';
    if (categories.includes('3DS')) return '3ds-core';
    if (categories.includes('Card Production')) return 'cpp-logical';
  }

  return null;
}

const VERSION_PATTERNS: RegExp[] = [
  // Negative lookahead (?![0-9.]) stops the match before any continuation digit or dot,
  // preventing "4.0" from being extracted when the slug actually contains "4.0.1_...".
  /_v?(\d+\.\d+\.\d+)(?![0-9.])/,  // slug: _v3.1.2 or _3.1.2
  /\bv(\d+\.\d+\.\d+)(?![0-9.])/,  // title: v3.1.2
  /_v?(\d+\.\d+)(?![0-9.])/,        // slug: _v3.1 or _3.1
  /\bv(\d+\.\d+)(?![0-9.])/,        // title: v3.1
];

export function inferVersion(s: string): string | null {
  for (const p of VERSION_PATTERNS) {
    const m = s.match(p);
    if (m) return m[1]!;
  }
  return null;
}

export const DOCUMENT_TYPE_MAP: Record<string, string> = {
  'Standard': 'standard',
  'Guidance Document': 'guidance',
  'Supporting Document': 'guidance',
  'FAQ': 'faq',
  'Information Supplement': 'supplemental',
  'Template': 'template',
  'Self-Assessment Questionnaire': 'saq',
  'SAQ': 'saq',
  'Report': 'report',
  'Bulletin': 'bulletin',
  'Program Guide': 'program-guide',
};

export function normalizeDocType(raw: string): string {
  for (const [key, value] of Object.entries(DOCUMENT_TYPE_MAP)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return 'guidance';
}
