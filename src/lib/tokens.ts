import type { Status } from './schema';

export const tokens = {
  color: {
    bg: '#f1ece1',
    bgSubtle: '#efe9dd',
    bgCard: '#fbf7ee',
    text: '#211e19',
    textMuted: '#6b655b',
    textFaint: '#8a8377',
    border: '#e0d9cb',
    borderSubtle: '#e7e0d2',
    accent: '#1f5f5b',
    accentHover: '#174d4a',
  },
  status: {
    active: '#1f7a4d',
    'under-review': '#3a4f9e',
    forthcoming: '#2f6f9e',
    'sunset-scheduled': '#9a6512',
    retired: '#6b6760',
  } satisfies Record<Status, string>,
  statusBg: {
    active: '#e7f3ec',
    'under-review': '#e9ecfb',
    forthcoming: '#e6f0f7',
    'sunset-scheduled': '#fbf0db',
    retired: '#ece9e3',
  } satisfies Record<Status, string>,
  statusDot: {
    active: '#2a9d63',
    'under-review': '#5a6fd0',
    forthcoming: '#4a8fc0',
    'sunset-scheduled': '#d39314',
    retired: '#9a948b',
  } satisfies Record<Status, string>,
  font: {
    display: "'Newsreader', Georgia, serif",
    ui: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
} as const;

export const statusLabel: Record<Status, string> = {
  active: 'Active',
  'under-review': 'Under review',
  forthcoming: 'Forthcoming',
  'sunset-scheduled': 'Sunset scheduled',
  retired: 'Retired',
};
