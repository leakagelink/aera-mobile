import { useRouter } from 'expo-router';
import { ArrowRight, Gauge, MapPinned, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { LogoMark } from '@/components/ui/LogoMark';
import { useT, type MessageKey } from '@/i18n';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme/useTheme';

const steps: { title: MessageKey; copy: MessageKey; icon: typeof MapPinned }[] = [
  { title: 'onboarding.oneTitle', copy: 'onboarding.oneBody', icon: MapPinned },
  { title: 'onboarding.twoTitle', copy: 'onboarding.twoBody', icon: Search },
  { title: 'onboarding.threeTitle', copy: 'onboarding.threeBody', icon: Gauge },
];

export default function OnboardingRoute() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useT();
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
            {t('onboarding.skip')}
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
        {t(item.title)}
      </AppText>
      <AppText size={16} color={theme.colors.mutedForeground} style={styles.copy}>
        {t(item.copy)}
      </AppText>
      <PrimaryButton icon={step === steps.length - 1 ? undefined : ArrowRight} onPress={() => (step === steps.length - 1 ? finish() : setStep(step + 1))} style={styles.button}>
        {step === steps.length - 1 ? t('onboarding.start') : t('onboarding.next')}
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
