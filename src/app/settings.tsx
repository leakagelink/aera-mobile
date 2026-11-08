import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useT } from '@/i18n';
import { clearAiMemory } from '@/services/ai/chat';
import { registerArahNotifications } from '@/services/notifications/register';
import { geocodingProvider } from '@/services/providers';
import { useLocationStore } from '@/store/locationStore';
import { useAccountStore } from '@/store/sessionAuthStore';
import { usePreferencesStore, type AssistantLanguage, type SavedShortcut } from '@/store/preferencesStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import type { UnitSystem } from '@/utils/format';

const units: { id: UnitSystem; label: string }[] = [
  { id: 'metric', label: 'Km' },
  { id: 'imperial', label: 'Mile' },
];

const languages: { id: AssistantLanguage; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'mr', label: 'मराठी' },
  { id: 'ta', label: 'தமிழ்' },
  { id: 'te', label: 'తెలుగు' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'kn', label: 'ಕನ್ನಡ' },
  { id: 'ml', label: 'മലയാളം' },
  { id: 'pa', label: 'ਪੰਜਾਬੀ' },
  { id: 'ur', label: 'اردو' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useT();
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
      Alert.alert(t('settings.locationTitle'), t('settings.locationBody'));
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
      Alert.alert(t('settings.saveFailedTitle'), t('settings.saveFailedBody'));
    }
  }

  function confirmClear() {
    Alert.alert(t('settings.clearTitle'), t('settings.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void clearHistory() },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title={t('settings.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          {t('settings.appearance')}
        </AppText>
        <ChoiceRow
          options={[
            { id: 'dark', label: t('settings.dark') },
            { id: 'light', label: t('settings.light') },
            { id: 'system', label: t('settings.phone') },
          ]}
          value={preference}
          onChange={setTheme}
        />
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          {t('settings.units')}
        </AppText>
        <ChoiceRow options={units} value={unit} onChange={setUnits} />
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          {t('settings.language')}
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
          {t('settings.languageNote')}
        </AppText>
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          {t('settings.saved')}
        </AppText>
        <ShortcutRow label={t('common.home')} place={home} onSave={() => void saveShortcut('home')} onClear={() => setHome(null)} />
        <ShortcutRow label={t('common.work')} place={work} onSave={() => void saveShortcut('work')} onClear={() => setWork(null)} />
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
              {t('settings.favoriteRemove')}
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
            {rememberChats ? t('settings.chatsOn') : t('settings.chatsOff')}
          </AppText>
          <AppText size={13} color={theme.colors.mutedForeground}>
            {t('settings.chatsDetail')}
          </AppText>
        </Pressable>
        <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
          {t('common.privacy')}
        </AppText>
        {signedIn ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void registerArahNotifications().catch(() => undefined)}
            style={[styles.link, { backgroundColor: theme.colors.surface }]}
          >
            <AppText size={15} weight="medium">
              {t('settings.notifications')}
            </AppText>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/privacy')} style={[styles.link, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="medium">
            {t('settings.privacyLocation')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={confirmClear} style={[styles.link, { backgroundColor: `${theme.colors.error}14` }]}>
          <AppText size={15} weight="semibold" color={theme.colors.error}>
            {t('settings.clearTrips')}
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ShortcutRow({ label, place, onSave, onClear }: { label: string; place: SavedShortcut | null; onSave: () => void; onClear: () => void }) {
  const theme = useTheme();
  const { t } = useT();
  return (
    <View style={[styles.link, { backgroundColor: theme.colors.surface }]}>
      <AppText size={15} weight="medium">
        {label}
      </AppText>
      <AppText size={13} color={theme.colors.mutedForeground}>
        {place ? place.name : t('common.notSet')}
      </AppText>
      <View style={styles.shortcutActions}>
        <Pressable accessibilityRole="button" onPress={onSave}>
          <AppText size={13} weight="semibold" color={theme.colors.primary}>
            {place ? t('settings.changeHere') : t('settings.setHere')}
          </AppText>
        </Pressable>
        {place ? (
          <Pressable accessibilityRole="button" onPress={onClear}>
            <AppText size={13} weight="semibold" color={theme.colors.error}>
              {t('common.remove')}
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
