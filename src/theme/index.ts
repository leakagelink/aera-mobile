import { darkColors, lightColors, type ThemeColors } from '@/theme/colors';

export type ThemeMode = 'dark' | 'light';
export type ThemePreference = ThemeMode | 'system';

export type Theme = {
  mode: ThemeMode;
  colors: ThemeColors;
};

export const darkTheme: Theme = { mode: 'dark', colors: darkColors };
export const lightTheme: Theme = { mode: 'light', colors: lightColors };

export { font, type FontWeight } from '@/theme/typography';
export { radius, space } from '@/theme/spacing';
