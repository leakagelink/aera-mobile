import { useIsFocused, useRouter } from 'expo-router';
import { Coffee, LocateFixed, Plane, TrainFront, Trees } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { JourneyFields } from '@/components/routing/JourneyFields';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { LocationStatus } from '@/components/ui/LocationStatus';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { useAroundYou } from '@/features/map/useAroundYou';
import { useNearbyCategory } from '@/features/map/useNearbyCategory';
import { distanceMeters } from '@/utils/geo';
import { useLocationStore } from '@/store/locationStore';
import { useSessionStore } from '@/store/sessionStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const suggestions = [
  { id: 'coffee', label: 'Coffee', query: 'cafe', radius: 3_000, icon: Coffee },
  { id: 'parks', label: 'Parks', query: 'park', radius: 3_000, icon: Trees },
  { id: 'airport', label: 'Airport', query: 'airport', radius: 40_000, icon: Plane },
  { id: 'station', label: 'Station', query: '[railway=station]', radius: 15_000, icon: TrainFront },
];

export default function MapScreen() {
  const focused = useIsFocused();
  useForegroundLocation(focused, 'browse');
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AeraMapHandle>(null);
  const [follow, setFollow] = useState(true);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const location = useLocationStore((state) => state.current);
  const permission = useLocationStore((state) => state.permission);
  const availability = useLocationStore((state) => state.availability);
  const { here, nearby } = useAroundYou(location);
  const selected = suggestions.find((item) => item.id === categoryId) ?? null;
  const category = useNearbyCategory(location, selected?.query ?? null, selected?.radius ?? 0);
  const shownPlaces = selected ? category.places : nearby;

  useEffect(() => {
    if (!follow || !location || selected) return;
    mapRef.current?.recenter(location.longitude, location.latitude);
  }, [follow, location, selected]);

  const categoryPlaces = category.places;
  const categoryKey = categoryPlaces.map((place) => place.id).join(',');
  useEffect(() => {
    if (!selected || categoryPlaces.length === 0) return;
    const current = useLocationStore.getState().current;
    if (!current) return;
    mapRef.current?.fit([current, ...categoryPlaces]);
  }, [categoryKey, categoryPlaces, selected]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.ink }]}>
      <AeraMap
        ref={mapRef}
        user={location}
        nearby={shownPlaces}
        onUserGesture={() => setFollow(false)}
      />
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <JourneyFields />
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
        {here ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              You are at {here}
            </AppText>
          </View>
        ) : null}
        {selected && !location ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              Location is needed to find nearby {selected.label.toLowerCase()}.
            </AppText>
          </View>
        ) : null}
        {selected && location && category.loading ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              Looking for {selected.label.toLowerCase()} nearby…
            </AppText>
          </View>
        ) : null}
        {selected && location && !category.loading && category.places.length === 0 ? (
          <View style={[styles.here, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
            <AppText size={13} weight="semibold">
              No {selected.label.toLowerCase()} close to you.
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
      <View style={styles.actions}>
        <IconButton icon={LocateFixed} label="Recenter map" primary={follow} onPress={() => setFollow(true)} />
        <LocationStatus />
      </View>
      {permission !== 'granted' || availability === 'unavailable' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/permission')}
          style={[styles.banner, { bottom: insets.bottom + 96, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <AppText size={14} weight="semibold">
            {permission === 'denied' ? 'Location is off' : 'Location is needed for navigation'}
          </AppText>
          <AppText size={12} color={theme.colors.mutedForeground}>
            Tap to review foreground location access.
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
