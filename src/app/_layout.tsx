import 'react-native-gesture-handler';

import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { AppProviders } from '@/providers/AppProviders';
import { usePrefersReducedMotion } from '@/theme/ReducedMotion';
import { useTheme } from '@/theme/useTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduced ? 'none' : 'slide_from_right',
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="navigation" options={{ gestureEnabled: false, animation: reduced ? 'none' : 'fade' }} />
        <Stack.Screen name="trip-complete" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
