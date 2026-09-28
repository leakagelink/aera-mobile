import { useIsFocused, useRouter } from 'expo-router';
import { ArrowLeft, Navigation } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { TravelModeBar } from '@/components/routing/TravelModeBar';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton } from '@/components/ui/Buttons';
import { FloatingCard } from '@/components/ui/GlassCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { ErrorState } from '@/components/ui/States';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { useJourneyRoutes } from '@/features/routing/useJourneyRoutes';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { travelModeLabel } from '@/types/travel';
import { errorMessage } from '@/utils/errors';
import { formatDistance, formatDuration } from '@/utils/format';
import { distanceMeters } from '@/utils/geo';

export default function DestinationScreen() {
  const focused = useIsFocused();
  useForegroundLocation(focused, 'browse');
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AeraMapHandle>(null);
  const origin = useSessionStore((state) => state.origin);
  const destination = useSessionStore((state) => state.destination);
  const travelMode = useSessionStore((state) => state.travelMode);
  const location = useLocationStore((state) => state.current);
  const units = usePreferencesStore((state) => state.units);
  const start = origin ?? location;
  const startLatitude = start ? Number(start.latitude.toFixed(3)) : null;
  const startLongitude = start ? Number(start.longitude.toFixed(3)) : null;
  const routes = useJourneyRoutes(focused && destination !== null && start !== null);
  const route = useSessionStore((state) => selectedRoute(state));

  useEffect(() => {
    if (!destination || startLatitude == null || startLongitude == null) return;
    mapRef.current?.fit([{ latitude: startLatitude, longitude: startLongitude }, destination]);
  }, [destination, startLatitude, startLongitude]);

  if (!destination) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title="No destination" message="Search for a place before asking for directions." actionLabel="Search" onAction={() => router.replace('/search')} />
      </View>
    );
  }

  const straightLine = start ? formatDistance(distanceMeters(start, destination), units) : '—';
  const modeLabel = travelModeLabel(travelMode);

  return (
    <View style={styles.fill}>
      <AeraMap
        ref={mapRef}
        user={location}
        origin={origin}
        destination={destination}
        routes={route ? [{ id: route.id, coordinates: route.geometry, selected: true }] : []}
      />
      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />
      </View>
      <FloatingCard style={[styles.card, { marginBottom: insets.bottom + 12 }]}>
        <AppText size={13} color={theme.colors.mutedForeground} numberOfLines={1}>
          From {origin?.name ?? 'Your location'}
        </AppText>
        <View style={styles.modes}>
          <TravelModeBar />
        </View>
        <AppText size={26} weight="semibold">
          {destination.name}
        </AppText>
        <AppText size={13} color={theme.colors.mutedForeground} style={styles.address} numberOfLines={2}>
          {destination.address}
        </AppText>
        <View style={styles.metrics}>
          <MetricCard compact label="Straight line" value={straightLine} />
          <MetricCard compact label={modeLabel} value={route ? formatDuration(route.durationSeconds) : routes.isFetching ? '…' : '—'} />
          <MetricCard compact label="Distance" value={route ? formatDistance(route.distanceMeters, units) : '—'} />
        </View>
        {routes.isError ? (
          <AppText size={13} color={theme.colors.error} style={styles.error}>
            {errorMessage(routes.error)}
          </AppText>
        ) : null}
        {!start ? <AppText size={13} color={theme.colors.mutedForeground} style={styles.error}>Set a start place, or allow location, to calculate the route.</AppText> : null}
        <PrimaryButton
          icon={Navigation}
          disabled={!start || routes.isFetching}
          onPress={() => router.push('/routes')}
          style={styles.button}
        >
          Directions
        </PrimaryButton>
        {routes.isError ? (
          <PrimaryButton onPress={() => void routes.refetch()} style={styles.retry}>
            Try route again
          </PrimaryButton>
        ) : null}
      </FloatingCard>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  back: { position: 'absolute', left: 16 },
  card: { position: 'absolute', left: 12, right: 12, bottom: 0, padding: 20 },
  address: { marginTop: 6 },
  modes: { marginTop: 12 },
  metrics: { marginTop: 16, flexDirection: 'row', gap: 8 },
  error: { marginTop: 12, lineHeight: 18 },
  button: { marginTop: 16 },
  retry: { marginTop: 8 },
});
