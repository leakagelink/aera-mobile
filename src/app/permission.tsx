import { useRouter } from 'expo-router';
import { MapPin, ShieldCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { LogoMark } from '@/components/ui/LogoMark';
import { requestForegroundPermission } from '@/features/location/locationEngine';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme/useTheme';

export default function PermissionRoute() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const markSeen = usePreferencesStore((state) => state.markLocationPromptSeen);

  function goMap() {
    markSeen();
    router.replace('/map');
  }

  async function allow() {
    markSeen();
    await requestForegroundPermission();
    router.replace('/map');
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]}>
      <LogoMark />
      <View style={styles.center}>
        <View style={[styles.pin, { backgroundColor: `${theme.colors.primary}1A` }]}>
          <MapPin color={theme.colors.primary} size={42} fill={theme.colors.primary} />
        </View>
        <AppText size={34} weight="semibold" style={styles.title}>
          Location se rasta chalta hai.
        </AppText>
        <AppText size={16} color={theme.colors.mutedForeground} style={styles.copy}>
          Arah location tab use karta hai jab app khuli ho: aapki jagah, rasta, aur trip tabhi record jab aap shuru karo. Background mein nahi chalta.
        </AppText>
        <View style={[styles.note, { backgroundColor: `${theme.colors.success}1A` }]}>
          <ShieldCheck color={theme.colors.success} size={16} />
          <AppText size={12} weight="semibold" color={theme.colors.success}>
            Trip tab record hoti hai jab aap chaho
          </AppText>
        </View>
      </View>
      <PrimaryButton onPress={() => void allow()}>Location on karo</PrimaryButton>
      <SecondaryButton onPress={goMap} style={styles.secondary}>
        Abhi nahi
      </SecondaryButton>
      <Pressable accessibilityRole="button" onPress={() => router.push('/privacy')} style={styles.privacy}>
        <AppText size={12} weight="medium" color={theme.colors.mutedForeground}>
          Privacy
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 32, textAlign: 'center', lineHeight: 40 },
  copy: { marginTop: 16, textAlign: 'center', lineHeight: 24 },
  note: { marginTop: 24, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  secondary: { marginTop: 12 },
  privacy: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
