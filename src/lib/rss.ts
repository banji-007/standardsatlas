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
  // Ambiguous categories — resolved by title in resolveStandardSlug()
  // 'Software Security': -> secure-software or secure-slc
  // 'PTS': -> pts-poi or pts-hsm
  // '3DS': -> 3ds-core or 3ds-sdk
  // 'Card Production': -> cpp-logical or cpp-physical
  // 'PA-DSS\\PA-QSA (Archived)': -> pa-dss
};

const EXCLUDED_CATEGORIES = new Set(['Programs and Certification', 'Case Study', 'Guidance Document']);

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

const VERSION_PATTERNS: [RegExp, number][] = [
  [/_v?(\d+\.\d+\.\d+)/, 1],
  [/_v?(\d+\.\d+)/, 1],
  [/_(\d{4})/, 1],
];

export function inferVersion(slug: string): string | null {
  for (const [pattern, group] of VERSION_PATTERNS) {
    const match = slug.match(pattern);
    if (match) return match[group]!;
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
