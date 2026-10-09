import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { clearAiMemory } from '@/services/ai/chat';
import { registerArahNotifications } from '@/services/notifications/register';
import { geocodingProvider } from '@/services/providers';
import { useLocationStore } from '@/store/locationStore';
import { useAccountStore } from '@/store/sessionAuthStore';
import { usePreferencesStore, type AssistantLanguage, type SavedShortcut } from '@/store/preferencesStore';
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

const languages: { id: AssistantLanguage; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
  { id: 'mr', label: 'Marathi' },
  { id: 'ta', label: 'Tamil' },
  { id: 'te', label: 'Telugu' },
  { id: 'bn', label: 'Bengali' },
  { id: 'gu', label: 'Gujarati' },
  { id: 'kn', label: 'Kannada' },
  { id: 'ml', label: 'Malayalam' },
  { id: 'pa', label: 'Punjabi' },
  { id: 'ur', label: 'Urdu' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const preference = usePreferencesStore((state) => state.theme);
  const unit = usePreferencesStore((state) => state.units);
  const language = usePreferencesStore((state) => state.assistantLanguage);
  const home = usePreferencesStore((state) => state.home);
  const work = usePreferencesStore((state) => state.work);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const setUnits = usePreferencesStore((state) => state.setUnits);
  const setAssistantLanguage = usePreferencesStore((state) => state.setAssistantLanguage);
  const setHome = usePreferencesStore((state) => state.setHome);
  const setWork = usePreferencesStore((state) => state.setWork);
  const favorites = usePreferencesStore((state) => state.favorites);
  const removeFavorite = usePreferencesStore((state) => state.removeFavorite);
  const rememberChats = usePreferencesStore((state) => state.rememberChats);
  const setRememberChats = usePreferencesStore((state) => state.setRememberChats);
  const clearHistory = useTripStore((state) => state.clearHistory);
  const signedIn = useAccountStore((state) => state.token);

  async function saveShortcut(kind: 'home' | 'work') {
    const current = useLocationStore.getState().current;
    if (!current) {
      Alert.alert('Location needed', 'Allow location, then set this place from where you are.');
      return;
    }
    try {
      const place = await geocodingProvider().reverse(current);
      const shortcut: SavedShortcut = {
        name: place?.name ?? (kind === 'home' ? 'Home' : 'Work'),
        address: place?.address ?? 'Current location',
        latitude: current.latitude,
        longitude: current.longitude,
      };
      if (kind === 'home') setHome(shortcut);
      else setWork(shortcut);
    } catch {
      Alert.alert('Place was not saved', 'The address lookup failed. Try again.');
    }
  }

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
          Assistant language
        </AppText>
        <View style={styles.languages}>
          {languages.map((option) => {
            const active = option.id === language;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setAssistantLanguage(option.id)}
                style={[styles.language, { backgroundColor: active ? theme.colors.card : theme.colors.secondary }]}
              >
                <AppText size={13} weight="semibold" color={active ? theme.colors.foreground : theme.colors.mutedForeground}>
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText size={13} color={theme.colors.mutedForeground} style={styles.note}>
          Auto follows the language you type. Chats stay on this phone. Arah does not save the conversation on the server.
        </AppText>
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          Saved places
        </AppText>
        <ShortcutRow label="Home" place={home} onSave={() => void saveShortcut('home')} onClear={() => setHome(null)} />
        <ShortcutRow label="Work" place={work} onSave={() => void saveShortcut('work')} onClear={() => setWork(null)} />
        {favorites.map((place) => (
          <Pressable
            key={`${place.latitude},${place.longitude}`}
            accessibilityRole="button"
            onPress={() => removeFavorite(place)}
            style={[styles.link, { backgroundColor: theme.colors.surface }]}
          >
            <AppText size={15} weight="medium">
              {place.name}
            </AppText>
            <AppText size={13} color={theme.colors.mutedForeground}>
              Saved place. Tap to remove.
            </AppText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: rememberChats }}
          onPress={() => {
            const next = !rememberChats;
            setRememberChats(next);
            if (!next) void clearAiMemory().catch(() => undefined);
          }}
          style={[styles.link, { backgroundColor: theme.colors.surface }]}
        >
          <AppText size={15} weight="medium">
            {rememberChats ? 'Saved chats are on' : 'Saved chats are off'}
          </AppText>
          <AppText size={13} color={theme.colors.mutedForeground}>
            Recent assistant text stays on the server until you turn this off or delete the account.
          </AppText>
        </Pressable>
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          Privacy
        </AppText>
        {signedIn ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void registerArahNotifications().catch(() => undefined)}
            style={[styles.link, { backgroundColor: theme.colors.surface }]}
          >
            <AppText size={15} weight="medium">
              Turn on notifications
            </AppText>
          </Pressable>
        ) : null}
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

function ShortcutRow({ label, place, onSave, onClear }: { label: string; place: SavedShortcut | null; onSave: () => void; onClear: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.link, { backgroundColor: theme.colors.surface }]}>
      <AppText size={15} weight="medium">
        {label}
      </AppText>
      <AppText size={13} color={theme.colors.mutedForeground}>
        {place ? place.name : 'Not set'}
      </AppText>
      <View style={styles.shortcutActions}>
        <Pressable accessibilityRole="button" onPress={onSave}>
          <AppText size={13} weight="semibold" color={theme.colors.primary}>
            {place ? 'Update from here' : 'Set from here'}
          </AppText>
        </Pressable>
        {place ? (
          <Pressable accessibilityRole="button" onPress={onClear}>
            <AppText size={13} weight="semibold" color={theme.colors.error}>
              Clear
            </AppText>
          </Pressable>
        ) : null}
      </View>
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
  link: { marginTop: 10, minHeight: 56, borderRadius: radius.md, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  languages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  language: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  note: { marginTop: 8, lineHeight: 18 },
  shortcutActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
});
