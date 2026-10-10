import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { AppText } from '@/components/ui/AppText';
import { MetricCard } from '@/components/ui/MetricCard';
import { MetricGrid } from '@/components/ui/MetricGrid';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ErrorState } from '@/components/ui/States';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useResponsive } from '@/theme/useResponsive';
import { useTheme } from '@/theme/useTheme';
import { formatClock, formatDay, formatDistance, formatDuration, formatSpeed, speedUnit } from '@/utils/format';

export default function TripDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter, mapHeight, maxContent } = useResponsive();
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
        <ErrorState title="Safar nahi mila" message="Ye safar is phone ki list mein nahi hai." actionLabel="Wapas" onAction={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
    >
      <View style={[styles.column, { maxWidth: maxContent }]}>
        <ScreenHeader
          title={`${trip.originName} → ${trip.destinationName}`}
          titleLines={2}
          subtitle={`${formatDay(trip.startedAt)} · ${formatClock(trip.startedAt)}`}
          onBack={() => router.back()}
        />
        <View style={[styles.map, { height: mapHeight, marginHorizontal: gutter }]}>
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
        <MetricGrid style={{ marginTop: 16, paddingHorizontal: gutter }}>
          <MetricCard label="Doori" value={formatDistance(trip.distanceMeters, units)} />
          <MetricCard label="Time" value={formatDuration(trip.durationSeconds)} />
          <MetricCard label="Average speed" value={formatSpeed(trip.averageSpeedMps, units)} unit={speedUnit(units)} />
          <MetricCard label="Sabse tez" value={formatSpeed(trip.maxSpeedMps, units)} unit={speedUnit(units)} />
          {trip.movingTimeSeconds !== undefined ? <MetricCard label="Chalte" value={formatDuration(trip.movingTimeSeconds)} /> : null}
          {trip.stoppedTimeSeconds !== undefined ? <MetricCard label="Ruke" value={formatDuration(trip.stoppedTimeSeconds)} /> : null}
        </MetricGrid>
        <View style={[styles.summary, { backgroundColor: theme.colors.surface, marginHorizontal: gutter }]}>
          <AppText size={16} weight="semibold">
            Rasta
          </AppText>
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.copy}>
            {trip.routeSummary}
          </AppText>
          <AppText size={13} style={styles.copy}>
            Shuru {formatClock(trip.startedAt)} · Khatam {formatClock(trip.endedAt)}
          </AppText>
          <AppText size={13} color={theme.colors.mutedForeground} style={styles.copy}>
            {trip.sampleCount} location ke nishaan
            {trip.routeProgress !== undefined ? ` · planned raste ka ${Math.round(trip.routeProgress * 100)}%` : ''}
            {trip.recovered ? ' · app band hone ke baad save hua' : ''}
          </AppText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
  map: { borderRadius: radius.xl, overflow: 'hidden' },
  summary: { marginTop: 8, borderRadius: radius.md, padding: 16 },
  copy: { marginTop: 8, lineHeight: 20 },
});
