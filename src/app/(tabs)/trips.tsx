import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { MetricCard } from '@/components/ui/MetricCard';
import { TripCard } from '@/components/trips/TripCard';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatClock, formatDay, formatDistance, formatDuration, withinFilter } from '@/utils/format';

const filters = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All' },
] as const;

export default function TripsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const units = usePreferencesStore((state) => state.units);
  const trips = useTripStore((state) => state.trips);
  const ready = useTripStore((state) => state.ready);
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('week');

  const visible = useMemo(() => trips.filter((trip) => withinFilter(trip.startedAt, filter)), [trips, filter]);
  const distance = visible.reduce((sum, trip) => sum + trip.distanceMeters, 0);
  const duration = visible.reduce((sum, trip) => sum + trip.durationSeconds, 0);
  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const trip of visible) {
      const label = formatDay(trip.startedAt);
      map.set(label, [...(map.get(label) ?? []), trip]);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120, paddingHorizontal: 20 }}>
      <AppText size={34} weight="semibold">
        Your journeys
      </AppText>
      <AppText size={14} color={theme.colors.mutedForeground} style={styles.subtitle}>
        Trips you start are stored on this device.
      </AppText>
      <View style={[styles.filters, { backgroundColor: theme.colors.secondary }]}>
        {filters.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => setFilter(item.id)} style={[styles.filter, active && { backgroundColor: theme.colors.card }]}>
              <AppText size={12} weight="semibold" color={active ? theme.colors.foreground : theme.colors.mutedForeground}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.metrics}>
        <MetricCard compact label="Distance" value={formatDistance(distance, units)} />
        <MetricCard compact label="Travel time" value={formatDuration(duration)} />
      </View>
      {!ready ? <AppText color={theme.colors.mutedForeground}>Loading trips…</AppText> : null}
      {ready && visible.length === 0 ? (
        <View style={styles.empty}>
          <AppText size={18} weight="semibold">
            No trips yet
          </AppText>
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.emptyCopy}>
            Start navigation from the map. Arah records the trip only after you choose to begin.
          </AppText>
        </View>
      ) : null}
      {groups.map(([label, items]) => (
        <View key={label} style={styles.group}>
          <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.groupLabel}>
            {label}
          </AppText>
          {items.map((trip) => (
            <TripCard
              key={trip.id}
              title={`${trip.originName} → ${trip.destinationName}`}
              detail={`${formatDistance(trip.distanceMeters, units)} · ${formatDuration(trip.durationSeconds)} · ${formatClock(trip.startedAt)}${trip.recovered ? ' · recovered' : ''}`}
              onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 8 },
  filters: { marginTop: 20, borderRadius: radius.md, padding: 4, flexDirection: 'row' },
  filter: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metrics: { marginTop: 16, flexDirection: 'row', gap: 8 },
  empty: { marginTop: 28 },
  emptyCopy: { marginTop: 8, lineHeight: 20 },
  group: { marginTop: 22 },
  groupLabel: { letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
});
