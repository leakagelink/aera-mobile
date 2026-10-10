import { useIsFocused, useRouter } from 'expo-router';
import { Coffee, Fuel, Hospital, LocateFixed, ParkingCircle, Plane, TrainFront, Trees, Utensils } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UsualRouteCard } from '@/components/trips/UsualRouteCard';
import { HomeVoice } from '@/components/assistant/HomeVoice';
import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { JourneyFields } from '@/components/routing/JourneyFields';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { LocationStatus } from '@/components/ui/LocationStatus';
import { useAutoTrip } from '@/features/trips/useAutoTrip';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { useAroundYou } from '@/features/map/useAroundYou';
import { useNearbyCategory } from '@/features/map/useNearbyCategory';
import { shareEta } from '@/features/navigation/shareEta';
import { useJourneyRoutes } from '@/features/routing/useJourneyRoutes';
import { useRouteTraffic } from '@/features/traffic/useRouteTraffic';
import { distanceMeters } from '@/utils/geo';
import { errorMessage } from '@/utils/errors';
import { formatDuration } from '@/utils/format';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const suggestions = [
  { id: 'hospital', label: 'Aspatal', query: 'hospital', radius: 5_000, icon: Hospital },
  { id: 'fuel', label: 'Petrol', query: 'fuel', radius: 5_000, icon: Fuel },
  { id: 'coffee', label: 'Coffee', query: 'cafe', radius: 3_000, icon: Coffee },
  { id: 'food', label: 'Khana', query: 'restaurant', radius: 3_000, icon: Utensils },
  { id: 'parking', label: 'Parking', query: 'parking', radius: 2_000, icon: ParkingCircle },
  { id: 'parks', label: 'Park', query: 'park', radius: 3_000, icon: Trees },
  { id: 'airport', label: 'Airport', query: 'airport', radius: 40_000, icon: Plane },
  { id: 'station', label: 'Station', query: '[railway=station]', radius: 15_000, icon: TrainFront },
];

export default function MapScreen() {
  const focused = useIsFocused();
  useForegroundLocation(focused, 'browse');
  useAutoTrip(focused);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AeraMapHandle>(null);
  const [follow, setFollow] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const home = usePreferencesStore((state) => state.home);
  const work = usePreferencesStore((state) => state.work);
  const location = useLocationStore((state) => state.current);
  const destination = useSessionStore((state) => state.destination);
  const routes = useSessionStore((state) => state.routes);
  const route = useSessionStore((state) => selectedRoute(state));
  const units = usePreferencesStore((state) => state.units);
  const journey = useJourneyRoutes(focused && destination !== null);
  const traffic = useRouteTraffic(route?.geometry);
  const permission = useLocationStore((state) => state.permission);
  const availability = useLocationStore((state) => state.availability);
  const { here, nearby } = useAroundYou(location);
  const selected = suggestions.find((item) => item.id === categoryId) ?? null;
  const category = useNearbyCategory(location, selected?.query ?? null, selected?.radius ?? 0);
  const shownPlaces = selected ? category.places : nearby;

  useEffect(() => {
    if (selected || destination) return;
    if (!follow || !location) return;
    mapRef.current?.recenter(location.longitude, location.latitude);
  }, [follow, location, selected, destination]);

  const destinationId = destination?.id ?? null;
  const routeId = route?.id ?? null;
  useEffect(() => {
    if (selected || !destinationId) return;
    const current = useLocationStore.getState().current;
    const chosen = useSessionStore.getState().destination;
    const activeRoute = selectedRoute(useSessionStore.getState());
    if (!chosen) return;
    const points = activeRoute && activeRoute.geometry.length >= 2 ? activeRoute.geometry : current ? [current, chosen] : [chosen];
    mapRef.current?.fit(points);
  }, [destinationId, routeId, selected]);

  const categoryPlaces = category.places;
  const categoryKey = categoryPlaces.map((place) => place.id).join(',');
  useEffect(() => {
    if (!selected || categoryPlaces.length === 0) return;
    const current = useLocationStore.getState().current;
    if (!current) return;
    mapRef.current?.fit([current, ...categoryPlaces]);
  }, [categoryKey, categoryPlaces, selected]);

  function openSaved(kind: 'home' | 'work') {
    const saved = kind === 'home' ? usePreferencesStore.getState().home : usePreferencesStore.getState().work;
    if (!saved) {
      router.push('/settings');
      return;
    }
    setFollow(false);
    useSessionStore.getState().setDestination({
      id: `saved:${kind}`,
      name: kind === 'home' ? 'Ghar' : 'Office',
      address: saved.address,
      latitude: saved.latitude,
      longitude: saved.longitude,
    });
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.ink }]}>
      <AeraMap
        ref={mapRef}
        user={location}
        destination={destination}
        nearby={shownPlaces}
        routes={routes.map((item) => ({ id: item.id, coordinates: item.geometry, selected: item.id === route?.id }))}
        traffic={traffic.lines}
        onUserGesture={() => setFollow(false)}
      />
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <UsualRouteCard location={location} />
        <JourneyFields />
        <View style={styles.savedRow}>
          <Pressable accessibilityRole="button" onPress={() => openSaved('home')} style={[styles.chip, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              {home ? 'Ghar' : 'Ghar set karo'}
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => openSaved('work')} style={[styles.chip, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              {work ? 'Office' : 'Office set karo'}
            </AppText>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {suggestions.map((item) => {
            const Icon = item.icon;
            const active = item.id === categoryId;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setFollow(false);
                  setCategoryId(active ? null : item.id);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.nav,
                    borderColor: active ? theme.colors.primary : theme.colors.glassBorder,
                  },
                ]}
              >
                <Icon color={active ? theme.colors.primaryForeground : theme.colors.foreground} size={14} />
                <AppText size={12} weight="medium" color={active ? theme.colors.primaryForeground : theme.colors.foreground}>
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        {destination ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/destination')} style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              Jaana hai: {destination.name}
            </AppText>
            <AppText size={12} color={theme.colors.mutedForeground}>
              {route
                ? `Neela rasta · ${formatDuration(route.durationSeconds)} · ${formatDistance(route.distanceMeters)}`
                : journey.isFetching
                  ? 'Asli rasta nikal raha hai…'
                  : journey.isError
                    ? errorMessage(journey.error)
                    : 'Neela rasta abhi nahi hai. Is card par tap karke directions kholo.'}
            </AppText>
            {route?.limitNote ? (
              <AppText size={12} color={theme.colors.mutedForeground}>
                {route.limitNote}
              </AppText>
            ) : null}
            {traffic.note ? (
              <AppText size={12} color={theme.colors.mutedForeground}>
                {traffic.note}
              </AppText>
            ) : null}
            {route ? (
              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  void shareEta({ destination: destination.name, seconds: route.durationSeconds, meters: route.distanceMeters, units });
                }}
              >
                <AppText size={13} weight="semibold" color={theme.colors.primary}>
                  ETA bhejo
                </AppText>
              </Pressable>
            ) : null}
          </Pressable>
        ) : null}
        {here && !destination ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              Aap yahan ho: {here}
            </AppText>
          </View>
        ) : null}
        {selected && !location ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              {selected.label} ke liye location chahiye.
            </AppText>
          </View>
        ) : null}
        {selected && location && category.loading ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              {selected.label} dhoondh raha hoon…
            </AppText>
          </View>
        ) : null}
        {selected && location && !category.loading && category.places.length === 0 ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              Paas mein {selected.label} nahi mila.
            </AppText>
          </View>
        ) : null}
        {shownPlaces.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {shownPlaces.map((place) => (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                onPress={() => {
                  setFollow(false);
                  if (selected) useSessionStore.getState().setDestination(place);
                  mapRef.current?.recenter(place.longitude, place.latitude, 17);
                }}
                style={[styles.chip, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}
              >
                <AppText size={12} weight="medium">
                  {place.name}
                  {location ? ` · ${formatDistance(distanceMeters(location, place))}` : ''}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View pointerEvents="box-none" style={[styles.voice, { bottom: insets.bottom + (permission !== 'granted' || availability === 'unavailable' ? 176 : 88) }]}>
        <HomeVoice />
      </View>
      <View style={styles.actions}>
        <IconButton
          icon={LocateFixed}
          label="Map wapas lao"
          primary={follow}
          onPress={() => {
            setFollow(true);
            const chosen = useSessionStore.getState().destination;
            const activeRoute = selectedRoute(useSessionStore.getState());
            const current = useLocationStore.getState().current;
            if (chosen) {
              const points = activeRoute && activeRoute.geometry.length >= 2 ? activeRoute.geometry : current ? [current, chosen] : [chosen];
              mapRef.current?.fit(points);
              return;
            }
            if (current) mapRef.current?.recenter(current.longitude, current.latitude);
          }}
        />
        <LocationStatus />
      </View>
      {permission !== 'granted' || availability === 'unavailable' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/permission')}
          style={[styles.banner, { bottom: insets.bottom + 96, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <AppText size={14} weight="semibold">
            {permission === 'denied' ? 'Location band hai' : 'Raste ke liye location chahiye'}
          </AppText>
          <AppText size={12} color={theme.colors.mutedForeground}>
            Tap karke location on karo. Background mein nahi chalti.
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: 'absolute', left: 16, right: 16, gap: 12 },
  chips: { gap: 8, paddingRight: 8 },
  savedRow: { flexDirection: 'row', gap: 8 },
  here: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chip: {
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  voice: { position: 'absolute', left: 16, right: 16 },
  actions: { position: 'absolute', right: 16, top: '38%', gap: 10, alignItems: 'flex-end' },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
});
