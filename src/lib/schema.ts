import { z } from 'zod';

export const StatusSchema = z.enum([
  'active',
  'under-review',
  'sunset-scheduled',
  'retired',
  'forthcoming',
]);

export const DocumentTypeSchema = z.enum([
  'standard',
  'guidance',
  'faq',
  'template',
  'saq',
  'report',
  'bulletin',
  'supplemental',
  'program-guide',
]);

export const VersionStatusSchema = z.enum([
  'active',
  'sunset-scheduled',
  'retired',
]);

export const VersionSchema = z.object({
  version: z.string(),
  published: z.coerce.date().nullable(),
  retired: z.coerce.date().nullable(),
  status: VersionStatusSchema,
  source_url: z.string().url().nullable().default(null),
  verified: z.boolean(),
});

export const DocumentSchema = z.object({
  slug: z.string(),
  title: z.string(),
  type: DocumentTypeSchema,
  published: z.coerce.date().nullable(),
  applies_to_version: z.string().nullable().default(null),
  source_url: z.string().url().nullable().default(null),
  verified: z.boolean(),
});

export const StandardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  short: z.string(),
  family: z.string(),
  status: StatusSchema,
  source_url: z.string().url(),
  verified: z.boolean(),
  last_verified: z.coerce.date().nullable(),
  current_version: z.string().nullable(),
  notes: z.string().optional(),
  versions: z.array(VersionSchema).default([]),
  documents: z.array(DocumentSchema).default([]),
});

export const FaqMappingMethodSchema = z.enum(['direct', 'disambiguated', 'inferred', 'general', 'excluded']);

export const FaqEntrySchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  updated: z.string().nullable(),
  standards: z.array(z.string()).default([]),
  mapping_method: FaqMappingMethodSchema,
  source_url: z.string().url(),
  verified: z.boolean(),
});

export const FaqsFileSchema = z.object({
  faqs: z.array(FaqEntrySchema),
});

export type FaqEntry = z.infer<typeof FaqEntrySchema>;

export const VersionCandidateReasonSchema = z.enum(['version-newer', 'bulletin-retirement']);

export const VersionCandidateSchema = z.object({
  slug: z.string(),
  standard_name: z.string(),
  current_version: z.string().nullable(),
  detected_version: z.string().nullable(),
  detected_date: z.string().nullable(),
  document_slug: z.string(),
  document_title: z.string(),
  source_url: z.string(),
  reason: VersionCandidateReasonSchema,
});

export const VersionCandidatesFileSchema = z.object({
  generated: z.string(),
  candidates: z.array(VersionCandidateSchema),
});

export type VersionCandidate = z.infer<typeof VersionCandidateSchema>;

export const ReviewQueueBandSchema = z.enum(['low', 'medium']);

export const ReviewQueueItemSchema = z.object({
  entity_type: z.enum(['standard', 'faq', 'version-candidate']),
  id: z.string(),
  band: ReviewQueueBandSchema,
  reasons: z.array(z.string()),
});

export const ReviewQueueFileSchema = z.object({
  generated: z.string(),
  low_count: z.number().int(),
  medium_count: z.number().int(),
  items: z.array(ReviewQueueItemSchema),
});

export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;

export const RelationshipTypeSchema = z.enum(['associate', 'supersede', 'converge']);
export const RelationshipStateSchema = z.enum(['planned', 'in-progress', 'complete']);

export const RelationshipSchema = z.object({
  id: z.string(),
  type: RelationshipTypeSchema,
  from: z.string(),
  to: z.union([z.string(), z.array(z.string())]),
  state: RelationshipStateSchema,
  effective_date: z.coerce.date().nullable().default(null),
  description: z.string().nullable().default(null),
  source_url: z.string().url(),
  verified: z.boolean(),
});

export const ExternalBodySchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string().url().nullable().default(null),
  verified: z.boolean(),
});

export type Status = z.infer<typeof StatusSchema>;
export type VersionStatus = z.infer<typeof VersionStatusSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type Standard = z.infer<typeof StandardSchema>;
export type StandardVersion = z.infer<typeof VersionSchema>;
export type StandardDocument = z.infer<typeof DocumentSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type ExternalBody = z.infer<typeof ExternalBodySchema>;
