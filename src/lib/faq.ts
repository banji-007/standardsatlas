// Category-to-standard mapping for the PCI SSC FAQ RSS feed (?type=faq).
// The RSS <category> element is a single semicolon-delimited string, not multiple elements.

const PCI_DSS_CATS = new Set([
  'PCI_DSS', 'SAQ_A', 'SAQ_A_EP', 'SAQ_B', 'SAQ_B_IP', 'SAQ_C', 'SAQ_C_VT', 'SAQ_P2PE_HW',
  'Scoping', 'Compensating_Controls', 'Prioritized_Approach', 'Attestation_of_Compliance',
  'Reports_of_Compliance_ROC', 'Reports_of_Validation_ROV', 'Self_Assessment_Questionaire',
  'Compliance',
]);

const DIRECT: Record<string, string> = {
  P2PE: 'p2pe',
  SPoC: 'spoc',
  TSP: 'tsp',
};

// FAQs whose categories consist entirely of these are program/admin content;
// no standard is attached and the title fallback does not fire.
const PROGRAM_CATS = new Set([
  'QSA_PCI_DSS', 'ASV_PCI_DSS', 'ISA_PCI_DSS', 'PFI', 'PCI_Council_Info', 'Training', 'Programs',
]);

export type FaqMappingMethod = 'direct' | 'disambiguated' | 'inferred' | 'general' | 'excluded';

export interface FaqResolution {
  standards: string[];
  mapping_method: FaqMappingMethod;
}

export function parseFaqCategories(raw: string | string[] | undefined): string[] {
  const joined = Array.isArray(raw) ? raw.join(';') : (raw ?? '');
  return joined.split(';').map(c => c.trim()).filter(Boolean);
}

export function resolveFaq(categories: string[], title: string): FaqResolution {
  const standards = new Set<string>();
  let isDefinitelyProgram = false;
  let hasAmbiguous = false;

  for (const cat of categories) {
    if (PCI_DSS_CATS.has(cat)) {
      standards.add('pci-dss');
    } else if (DIRECT[cat]) {
      standards.add(DIRECT[cat]!);
    } else if (cat === 'PTS') {
      hasAmbiguous = true;
      standards.add(/\bhsm\b|hardware\s+security\s+module/i.test(title) ? 'pts-hsm' : 'pts-poi');
    } else if (cat === '3DS') {
      hasAmbiguous = true;
      standards.add(/\bsdk\b/i.test(title) ? '3ds-sdk' : '3ds-core');
    } else if (cat === 'SSF') {
      hasAmbiguous = true;
      const hasSlc = /secure\s+slc|software\s+lifecycle/i.test(title);
      const hasSw  = /secure\s+software/i.test(title);
      if (hasSlc) standards.add('secure-slc');
      if (hasSw || !hasSlc) standards.add('secure-software');
    } else if (PROGRAM_CATS.has(cat)) {
      isDefinitelyProgram = true;
    }
    // 'Standards' and unknown categories: no action, no isDefinitelyProgram flag
  }

  if (standards.size > 0) {
    return {
      standards: [...standards].sort(),
      mapping_method: hasAmbiguous ? 'disambiguated' : 'direct',
    };
  }

  if (isDefinitelyProgram) {
    return { standards: [], mapping_method: 'excluded' };
  }

  // Title keyword fallback for blank-category and 'Standards'-only FAQs
  if (/\bpci\s+dss\b|\bsaq\b|\bcardholders?\b|\bmerchants?\b|\bscoping\b/i.test(title)) {
    return { standards: ['pci-dss'], mapping_method: 'inferred' };
  }
  if (/\bp2pe\b/i.test(title)) return { standards: ['p2pe'], mapping_method: 'inferred' };
  if (/\bspoc\b/i.test(title)) return { standards: ['spoc'], mapping_method: 'inferred' };
  if (/\btsp\b/i.test(title))  return { standards: ['tsp'],  mapping_method: 'inferred' };
  if (/\b3ds\b|three.domain\s+secure/i.test(title))    return { standards: ['3ds-core'], mapping_method: 'inferred' };
  if (/\bpts\b|point.of.interaction|\bpoi\b/i.test(title)) return { standards: ['pts-poi'], mapping_method: 'inferred' };

  return { standards: [], mapping_method: 'general' };
}
