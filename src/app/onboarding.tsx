import { useRouter } from 'expo-router';
import { ArrowRight, Gauge, MapPinned, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { LogoMark } from '@/components/ui/LogoMark';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme/useTheme';

const steps = [
  {
    title: 'Meet your intelligent map.',
    copy: 'See where you are, search real places, and follow a live route.',
    icon: MapPinned,
  },
  {
    title: 'Compare the way there.',
    copy: 'Aera asks the road network for distance, time, and alternatives.',
    icon: Search,
  },
  {
    title: 'Record the trips you start.',
    copy: 'Distance, time, and speed stay on this device until you delete them.',
    icon: Gauge,
  },
];

export default function OnboardingRoute() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const completeOnboarding = usePreferencesStore((state) => state.completeOnboarding);
  const [step, setStep] = useState(0);
  const item = steps[step];

  function finish() {
    completeOnboarding();
    router.replace('/permission');
  }

  if (!item) return null;
  const Icon = item.icon;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        <LogoMark />
        <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
          <AppText size={14} weight="medium" color={theme.colors.mutedForeground}>
            Skip
          </AppText>
        </Pressable>
      </View>
      <View style={[styles.stage, { backgroundColor: theme.colors.ink }]}>
        <View style={[styles.icon, { backgroundColor: theme.colors.nav, borderColor: `${theme.colors.primary}40` }]}>
          <Icon color={theme.colors.primary} size={42} strokeWidth={1.6} />
        </View>
      </View>
      <View style={styles.dots}>
        {steps.map((_, index) => (
          <View key={index} style={[styles.dot, { width: index === step ? 32 : 8, backgroundColor: index === step ? theme.colors.primary : theme.colors.border }]} />
        ))}
      </View>
      <AppText size={34} weight="semibold" style={styles.title}>
        {item.title}
      </AppText>
      <AppText size={16} color={theme.colors.mutedForeground} style={styles.copy}>
        {item.copy}
      </AppText>
      <PrimaryButton icon={step === steps.length - 1 ? undefined : ArrowRight} onPress={() => (step === steps.length - 1 ? finish() : setStep(step + 1))} style={styles.button}>
        {step === steps.length - 1 ? 'Get started' : 'Next'}
      </PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  stage: { flex: 1, marginVertical: 28, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 96, height: 96, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dot: { height: 6, borderRadius: 99 },
  title: { lineHeight: 38 },
  copy: { marginTop: 12, lineHeight: 24 },
  button: { marginTop: 24 },
});
