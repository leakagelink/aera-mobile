import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { MetricCard } from '@/components/ui/MetricCard';
import { ErrorState } from '@/components/ui/States';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useSessionStore } from '@/store/sessionStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatClock, formatDistance, formatDuration, formatSpeed, speedUnit } from '@/utils/format';

export default function TripCompleteScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const units = usePreferencesStore((state) => state.units);
  const trip = useSessionStore((state) => state.completedTrip);
  const clearJourney = useSessionStore((state) => state.clearJourney);
  const mapRef = useRef<AeraMapHandle>(null);

  useEffect(() => {
    if (!trip || trip.samples.length < 2) return;
    const timer = setTimeout(() => mapRef.current?.fit(trip.samples), 500);
    return () => clearTimeout(timer);
  }, [trip]);

  if (!trip) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title="No completed trip" message="Finish a navigation session to see the summary." actionLabel="Back to map" onAction={() => router.replace('/map')} />
      </View>
    );
  }

  function goMap() {
    clearJourney();
    router.replace('/map');
  }

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.badge, { backgroundColor: `${theme.colors.success}1F` }]}>
        <Check color={theme.colors.success} size={42} strokeWidth={2.5} />
      </View>
      <AppText size={36} weight="semibold" style={styles.title}>
        Trip complete
      </AppText>
      <AppText size={14} color={theme.colors.mutedForeground}>
        {trip.originName} → {trip.destinationName}
      </AppText>
      <View style={styles.metrics}>
        <MetricCard label="Distance" value={formatDistance(trip.distanceMeters, units)} />
        <MetricCard label="Duration" value={formatDuration(trip.durationSeconds)} />
        <MetricCard label="Average speed" value={formatSpeed(trip.averageSpeedMps, units)} unit={speedUnit(units)} />
        <MetricCard label="Maximum speed" value={formatSpeed(trip.maxSpeedMps, units)} unit={speedUnit(units)} />
      </View>
      <View style={[styles.times, { backgroundColor: theme.colors.surface }]}>
        <AppText size={14}>Started {formatClock(trip.startedAt)}</AppText>
        <AppText size={14}>Ended {formatClock(trip.endedAt)}</AppText>
        <AppText size={13} color={theme.colors.mutedForeground}>
          {trip.routeSummary}
        </AppText>
        <AppText size={12} color={theme.colors.mutedForeground}>
          {trip.sampleCount} location samples
        </AppText>
      </View>
      <View style={styles.map}>
        <AeraMap ref={mapRef} routes={[{ id: trip.id, coordinates: trip.samples, selected: true }]} />
      </View>
      <PrimaryButton onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}>View trip</PrimaryButton>
      <SecondaryButton onPress={goMap} style={styles.secondary}>
        Back to map
      </SecondaryButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: 'center' },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16 },
  metrics: { marginTop: 24, width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  times: { marginTop: 12, width: '100%', borderRadius: radius.md, padding: 16, gap: 6 },
  map: { marginTop: 12, width: '100%', height: 180, borderRadius: radius.xl, overflow: 'hidden' },
  secondary: { marginTop: 10, alignSelf: 'stretch' },
});
