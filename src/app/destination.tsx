import { useIsFocused, useRouter } from 'expo-router';
import { ArrowLeft, Navigation } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton } from '@/components/ui/Buttons';
import { FloatingCard } from '@/components/ui/GlassCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { ErrorState } from '@/components/ui/States';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { useDrivingRoutes } from '@/features/routing/useDrivingRoutes';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/theme/useTheme';
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
  const destination = useSessionStore((state) => state.destination);
  const location = useLocationStore((state) => state.current);
  const units = usePreferencesStore((state) => state.units);
  const routes = useDrivingRoutes(focused && destination !== null && location !== null);
  const route = useSessionStore((state) => selectedRoute(state));

  useEffect(() => {
    if (!destination) return;
    const coordinates = location ? [location, destination] : [destination];
    mapRef.current?.fit(coordinates);
  }, [destination, location]);

  if (!destination) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title="No destination" message="Search for a place before asking for directions." actionLabel="Search" onAction={() => router.replace('/search')} />
      </View>
    );
  }

  const straightLine = location ? formatDistance(distanceMeters(location, destination), units) : '—';

  return (
    <View style={styles.fill}>
      <AeraMap ref={mapRef} user={location} destination={destination} routes={route ? [{ id: route.id, coordinates: route.geometry, selected: true }] : []} />
      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />
      </View>
      <FloatingCard style={[styles.card, { marginBottom: insets.bottom + 12 }]}>
        <AppText size={26} weight="semibold">
          {destination.name}
        </AppText>
        <AppText size={13} color={theme.colors.mutedForeground} style={styles.address} numberOfLines={2}>
          {destination.address}
        </AppText>
        <View style={styles.metrics}>
          <MetricCard compact label="Straight line" value={straightLine} />
          <MetricCard compact label="Drive" value={route ? formatDuration(route.durationSeconds) : routes.isFetching ? '…' : '—'} />
          <MetricCard compact label="Distance" value={route ? formatDistance(route.distanceMeters, units) : '—'} />
        </View>
        {routes.isError ? (
          <AppText size={13} color={theme.colors.error} style={styles.error}>
            {errorMessage(routes.error)}
          </AppText>
        ) : null}
        {!location ? <AppText size={13} color={theme.colors.mutedForeground} style={styles.error}>Allow location to calculate a driving route.</AppText> : null}
        <PrimaryButton
          icon={Navigation}
          disabled={!location || routes.isFetching}
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
  metrics: { marginTop: 16, flexDirection: 'row', gap: 8 },
  error: { marginTop: 12, lineHeight: 18 },
  button: { marginTop: 16 },
  retry: { marginTop: 8 },
});
