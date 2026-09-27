export const darkColors = {
  background: '#12151C',
  foreground: '#F3F7F6',
  card: '#1C212B',
  primary: '#3DDCB8',
  primaryForeground: '#062018',
  secondary: '#2A303C',
  mutedForeground: '#8E9AAB',
  success: '#3DCE86',
  warning: '#E6B34D',
  error: '#E25B4A',
  surface: '#222833',
  glass: 'rgba(18, 22, 30, 0.82)',
  glassBorder: 'rgba(236, 246, 242, 0.14)',
  nav: 'rgba(12, 15, 22, 0.92)',
  ink: '#0B0E14',
  hero: '#F4F8F7',
  heroMuted: '#A7B4BE',
  border: 'rgba(140, 160, 180, 0.28)',
  routeAlt: 'rgba(148, 176, 196, 0.85)',
  routeCasing: '#081018',
} as const;

export const lightColors = {
  background: '#F4F7F8',
  foreground: '#1A2230',
  card: '#FFFFFF',
  primary: '#0E9F86',
  primaryForeground: '#F4FFFC',
  secondary: '#E6EEF2',
  mutedForeground: '#5C6B7A',
  success: '#1E9A62',
  warning: '#B8860B',
  error: '#C84538',
  surface: '#EEF3F6',
  glass: 'rgba(255, 255, 255, 0.86)',
  glassBorder: 'rgba(20, 40, 50, 0.08)',
  nav: 'rgba(255, 255, 255, 0.94)',
  ink: '#0B0E14',
  hero: '#F4F8F7',
  heroMuted: '#5C6B7A',
  border: 'rgba(20, 40, 60, 0.12)',
  routeAlt: 'rgba(70, 100, 120, 0.7)',
  routeCasing: '#123038',
} as const;

export type ThemeColors = {
  [Key in keyof typeof darkColors]: string;
};
