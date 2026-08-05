export interface Doc {
  slug: string;
  title: string;
  type: string;
  published: string | null;
  applies_to_version: string | null;
  source_url: string | null;
  verified: boolean;
}

export interface Ver {
  version: string;
  published: string | null;
  retired: string | null;
  status: string;
  source_url: string | null;
  verified: boolean;
}

export interface StdData {
  slug: string;
  name: string;
  status: string;
  source_url: string;
  verified: boolean;
  last_verified: string | null;
  current_version: string | null;
  notes?: string;
  versions: Ver[];
  documents: Doc[];
}

export interface RelData {
  id: string;
  type: 'associate' | 'supersede' | 'converge';
  from: string;
  to: string | string[];
  state: 'planned' | 'in-progress' | 'complete';
  effective_date: string | null;
  description: string | null;
  source_url: string;
  verified: boolean;
}

export interface AppData {
  standards: StdData[];
  relationships: RelData[];
  lastVerified: string;
}
