import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTripStore } from '@/store/tripStore';
import type { ThemePreference } from '@/theme';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import type { UnitSystem } from '@/utils/format';

const themes: { id: ThemePreference; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'System' },
];

const units: { id: UnitSystem; label: string }[] = [
  { id: 'metric', label: 'Metric' },
  { id: 'imperial', label: 'Imperial' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const preference = usePreferencesStore((state) => state.theme);
  const unit = usePreferencesStore((state) => state.units);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const setUnits = usePreferencesStore((state) => state.setUnits);
  const clearHistory = useTripStore((state) => state.clearHistory);

  function confirmClear() {
    Alert.alert('Delete trip history?', 'This removes journeys stored on this device. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void clearHistory() },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          Appearance
        </AppText>
        <ChoiceRow options={themes} value={preference} onChange={setTheme} />
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          Units
        </AppText>
        <ChoiceRow options={units} value={unit} onChange={setUnits} />
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          Privacy
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => router.push('/privacy')} style={[styles.link, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="medium">
            Privacy and location
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={confirmClear} style={[styles.link, { backgroundColor: `${theme.colors.error}14` }]}>
          <AppText size={15} weight="semibold" color={theme.colors.error}>
            Delete trip history
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ChoiceRow<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.choices, { backgroundColor: theme.colors.secondary }]}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(option.id)} style={[styles.choice, active && { backgroundColor: theme.colors.card }]}>
            <AppText size={13} weight="semibold" color={active ? theme.colors.foreground : theme.colors.mutedForeground}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  label: { letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  choices: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  choice: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  link: { marginTop: 10, minHeight: 56, borderRadius: radius.md, justifyContent: 'center', paddingHorizontal: 16 },
});
