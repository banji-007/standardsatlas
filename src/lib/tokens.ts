import type { Status } from './schema';

export const tokens = {
  color: {
    bg: '#f8f8f6',
    bgDark: '#1a1a1a',
    text: '#1a1a1a',
    textDark: '#f0f0ee',
    border: '#e0e0de',
    borderDark: '#2e2e2e',
    accent: '#2a7a8a',
    accentDark: '#4db8cb',
  },
  status: {
    active: '#009E73',
    'under-review': '#E69F00',
    forthcoming: '#E69F00',
    'sunset-scheduled': '#D55E00',
    retired: '#767676',
  } satisfies Record<Status, string>,
  font: {
    ui: "'IBM Plex Sans Variable', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
} as const;


export const statusLabel: Record<Status, string> = {
  active: 'Active',
  'under-review': 'Under Review',
  forthcoming: 'Forthcoming',
  'sunset-scheduled': 'Sunset Scheduled',
  retired: 'Retired',
};
