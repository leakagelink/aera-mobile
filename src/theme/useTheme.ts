import { useColorScheme } from 'react-native';

import { usePreferencesStore } from '@/store/preferencesStore';
import { darkTheme, lightTheme, type Theme } from '@/theme';

export function useTheme(): Theme {
  const preference = usePreferencesStore((state) => state.theme);
  const system = useColorScheme();
  if (preference === 'system') return system === 'light' ? lightTheme : darkTheme;
  return preference === 'light' ? lightTheme : darkTheme;
}
