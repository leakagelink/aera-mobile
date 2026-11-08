import { useLocalSearchParams, useRouter } from 'expo-router';
import { History, MapPin } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useRecentPlaces, usePlaceSearch } from '@/features/search/usePlaceSearch';
import { useT } from '@/i18n';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/theme/useTheme';
import type { Place } from '@/types/place';
import { errorMessage } from '@/utils/errors';
import { formatDistance } from '@/utils/format';
import { distanceMeters } from '@/utils/geo';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; field?: string }>();
  const field = (Array.isArray(params.field) ? params.field[0] : params.field) === 'origin' ? 'origin' : 'destination';
  const initial = typeof params.q === 'string' ? params.q : '';
  const [query, setQuery] = useState(initial);
  const search = usePlaceSearch(query);
  const { places: recent, remember } = useRecentPlaces();
  const theme = useTheme();
  const { t } = useT();
  const location = useLocationStore((state) => state.current);
  const units = usePreferencesStore((state) => state.units);

  async function select(place: Place) {
    await remember(place);
    if (field === 'origin') {
      useSessionStore.getState().setOrigin(place);
      router.back();
      return;
    }
    useSessionStore.getState().setDestination(place);
    router.push('/destination');
  }

  function chooseCurrentLocation() {
    useSessionStore.getState().setOrigin(null);
    router.back();
  }

  const showResults = query.trim().length >= 2;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title={field === 'origin' ? t('search.originTitle') : t('search.destinationTitle')} onBack={() => router.back()} />
      <View style={styles.search}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={field === 'origin' ? t('search.originPlaceholder') : t('search.destinationPlaceholder')} autoFocus />
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {field === 'origin' ? (
          <Pressable accessibilityRole="button" onPress={chooseCurrentLocation} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <View style={[styles.icon, { backgroundColor: theme.colors.secondary }]}>
              <MapPin color={theme.colors.primary} size={18} />
            </View>
            <View style={styles.copy}>
              <AppText size={15} weight="semibold">
                {t('search.current')}
              </AppText>
              <AppText size={12} color={theme.colors.mutedForeground} numberOfLines={1}>
                {t('search.currentHint')}
              </AppText>
            </View>
          </Pressable>
        ) : null}
        {!showResults ? (
          <Section title={t('search.recent')}>
            {recent.length === 0 ? (
              <AppText size={14} color={theme.colors.mutedForeground}>
                {t('search.recentEmpty')}
              </AppText>
            ) : (
              recent.map((place) => (
                <PlaceRow key={place.id} place={place} icon="recent" distance={distanceLabel(location, place, units)} onPress={() => void select(place)} />
              ))
            )}
          </Section>
        ) : null}
        {showResults && search.isFetching && !search.data ? <LoadingState title={t('search.loadingTitle')} message={t('search.loadingBody')} /> : null}
        {showResults && search.isError ? (
          <ErrorState title={t('search.errorTitle')} message={errorMessage(search.error)} actionLabel={t('common.retry')} onAction={() => void search.refetch()} />
        ) : null}
        {showResults && search.isSuccess && search.data.length === 0 ? (
          <ErrorState title={t('search.emptyTitle')} message={t('search.emptyBody')} />
        ) : null}
        {showResults && search.data
          ? search.data.map((place) => (
              <PlaceRow
                key={place.id}
                place={place}
                icon="place"
                distance={distanceLabel(location, place, units)}
                onPress={() => void select(place)}
                onSave={() =>
                  usePreferencesStore.getState().addFavorite({
                    name: place.name,
                    address: place.address,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  })
                }
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

function distanceLabel(
  location: { latitude: number; longitude: number } | null,
  place: Place,
  units: 'metric' | 'imperial',
): string {
  if (!location) return '';
  return formatDistance(distanceMeters(location, place), units);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.sectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function PlaceRow({
  place,
  distance,
  icon,
  onPress,
  onSave,
}: {
  place: Place;
  distance: string;
  icon: 'recent' | 'place';
  onPress: () => void;
  onSave?: () => void;
}) {
  const theme = useTheme();
  const { t } = useT();
  const Icon = icon === 'recent' ? History : MapPin;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <View style={[styles.icon, { backgroundColor: theme.colors.secondary }]}>
        <Icon color={theme.colors.mutedForeground} size={18} />
      </View>
      <View style={styles.copy}>
        <AppText size={15} weight="semibold" numberOfLines={1}>
          {place.name}
        </AppText>
        <AppText size={12} color={theme.colors.mutedForeground} numberOfLines={1}>
          {place.address}
        </AppText>
      </View>
      {distance ? (
        <AppText size={12} color={theme.colors.mutedForeground}>
          {distance}
        </AppText>
      ) : null}
      {onSave ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.save')} onPress={onSave} hitSlop={8}>
          <AppText size={12} weight="semibold" color={theme.colors.primary}>
            {t('common.save')}
          </AppText>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  section: { marginTop: 20 },
  sectionTitle: { letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
});
