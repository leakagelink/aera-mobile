import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { AppText } from '@/components/ui/AppText';
import { MetricCard } from '@/components/ui/MetricCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ErrorState } from '@/components/ui/States';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatClock, formatDay, formatDistance, formatDuration, formatSpeed, speedUnit } from '@/utils/format';

export default function TripDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const units = usePreferencesStore((state) => state.units);
  const trip = useTripStore((state) => state.trips.find((item) => item.id === id));
  const mapRef = useRef<AeraMapHandle>(null);

  useEffect(() => {
    if (!trip || trip.samples.length < 2) return;
    const timer = setTimeout(() => mapRef.current?.fit(trip.samples), 500);
    return () => clearTimeout(timer);
  }, [trip]);

  if (!trip) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title="Trip not found" message="That journey is not in the local history." actionLabel="Back" onAction={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.fill, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      <ScreenHeader title={`${trip.originName} → ${trip.destinationName}`} subtitle={`${formatDay(trip.startedAt)} · ${formatClock(trip.startedAt)}`} onBack={() => router.back()} />
      <View style={styles.map}>
        <AeraMap
          ref={mapRef}
          routes={[
            ...(trip.plannedGeometry && trip.plannedGeometry.length > 1
              ? [{ id: `${trip.id}-planned`, coordinates: trip.plannedGeometry, selected: false }]
              : []),
            { id: trip.id, coordinates: trip.samples, selected: true },
          ]}
        />
      </View>
      <View style={styles.metrics}>
        <MetricCard label="Distance" value={formatDistance(trip.distanceMeters, units)} />
        <MetricCard label="Duration" value={formatDuration(trip.durationSeconds)} />
        <MetricCard label="Average speed" value={formatSpeed(trip.averageSpeedMps, units)} unit={speedUnit(units)} />
        <MetricCard label="Max speed" value={formatSpeed(trip.maxSpeedMps, units)} unit={speedUnit(units)} />
        {trip.movingTimeSeconds !== undefined ? <MetricCard label="Moving" value={formatDuration(trip.movingTimeSeconds)} /> : null}
        {trip.stoppedTimeSeconds !== undefined ? <MetricCard label="Stopped" value={formatDuration(trip.stoppedTimeSeconds)} /> : null}
      </View>
      <View style={[styles.summary, { backgroundColor: theme.colors.surface }]}>
        <AppText size={16} weight="semibold">
          Route summary
        </AppText>
        <AppText size={14} color={theme.colors.mutedForeground} style={styles.copy}>
          {trip.routeSummary}
        </AppText>
        <AppText size={13} style={styles.copy}>
          Started {formatClock(trip.startedAt)} · Ended {formatClock(trip.endedAt)}
        </AppText>
        <AppText size={13} color={theme.colors.mutedForeground}>
          {trip.sampleCount} location samples
          {trip.routeProgress !== undefined ? ` · ${Math.round(trip.routeProgress * 100)}% of the planned route` : ''}
          {trip.recovered ? ' · saved after the app closed' : ''}
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: 32 },
  map: { marginHorizontal: 20, height: 220, borderRadius: radius.xl, overflow: 'hidden' },
  metrics: { marginTop: 16, paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { margin: 20, borderRadius: radius.md, padding: 16 },
  copy: { marginTop: 8, lineHeight: 20 },
});
