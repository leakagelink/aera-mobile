import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LogoMark } from '@/components/ui/LogoMark';
import { aeraApiMode } from '@/services/api/client';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useAccountStore } from '@/store/sessionAuthStore';
import { usePrefersReducedMotion } from '@/theme/ReducedMotion';
import { useTheme } from '@/theme/useTheme';

export default function SplashRoute() {
  const router = useRouter();
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();
  const hydrated = usePreferencesStore((state) => state.hydrated);
  const onboarded = usePreferencesStore((state) => state.onboardingComplete);
  const promptSeen = usePreferencesStore((state) => state.locationPromptSeen);
  const permission = useLocationStore((state) => state.permission);
  const permissionKnown = useLocationStore((state) => state.permissionKnown);
  const sessionHydrated = useAccountStore((state) => state.hydrated);
  const token = useAccountStore((state) => state.token);
  const needsAccount = aeraApiMode() === 'aera-api';
  const ready = hydrated && permissionKnown && (!needsAccount || sessionHydrated);

  function continueToApp() {
    if (!ready) return;
    if (needsAccount && !token) {
      router.replace('/sign-in' as Href);
      return;
    }
    if (!onboarded) {
      router.replace('/onboarding');
      return;
    }
    if (!promptSeen && permission !== 'granted') {
      router.replace('/permission');
      return;
    }
    router.replace('/map');
  }

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      if (needsAccount && !token) router.replace('/sign-in' as Href);
      else if (!onboarded) router.replace('/onboarding');
      else if (!promptSeen && permission !== 'granted') router.replace('/permission');
      else router.replace('/map');
    }, reduced ? 0 : 1100);
    return () => clearTimeout(timer);
  }, [ready, needsAccount, token, onboarded, promptSeen, permission, reduced, router]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open Arah" onPress={continueToApp} style={[styles.screen, { backgroundColor: theme.colors.ink }]}>
      <LogoMark large />
      <AppText size={48} weight="semibold" color={theme.colors.hero} style={styles.title}>
        Arah
      </AppText>
      <AppText size={16} color={theme.colors.heroMuted}>
        Talk to your map.
      </AppText>
      <AppText size={12} color={theme.colors.heroMuted} style={styles.hint}>
        {ready ? 'Tap to begin' : 'Preparing your map'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 24 },
  hint: { position: 'absolute', bottom: 56 },
});
