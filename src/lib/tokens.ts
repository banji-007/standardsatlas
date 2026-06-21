import type { Status } from './schema';

export const tokens = {
  color: {
    bg: '#f1ece1',
    bgDark: '#1c1814',
    bgSubtle: '#fffdf8',
    bgSubtleDark: '#252019',
    text: '#2b2215',
    textDark: '#f2ede3',
    textMuted: '#5c5148',
    textMutedDark: '#c4b8a8',
    border: '#dcd2bb',
    borderDark: '#3a3028',
    accent: '#1f5f5b',
    accentDark: '#3d9e99',
  },
  status: {
    active: '#006b4f',
    'under-review': '#8a5c00',
    forthcoming: '#8a5c00',
    'sunset-scheduled': '#9a3d00',
    retired: '#565656',
  } satisfies Record<Status, string>,
  statusDark: {
    active: '#22c497',
    'under-review': '#f0b020',
    forthcoming: '#f0b020',
    'sunset-scheduled': '#f07030',
    retired: '#a0a0a0',
  } satisfies Record<Status, string>,
  font: {
    display: "'Newsreader', Georgia, serif",
    ui: "'IBM Plex Sans Variable', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
} as const;

export function getThemeTokens(): typeof tokens & { isDark: boolean } {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.dataset.theme === 'dark';
  return { ...tokens, isDark };
}

export const statusLabel: Record<Status, string> = {
  active: 'Active',
  'under-review': 'Under Review',
  forthcoming: 'Forthcoming',
  'sunset-scheduled': 'Sunset Scheduled',
  retired: 'Retired',
};
