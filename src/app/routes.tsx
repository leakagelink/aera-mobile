import { useIsFocused, useRouter } from 'expo-router';
import { ArrowLeft, Navigation } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { IconButton, PrimaryButton } from '@/components/ui/Buttons';
import { RouteCard } from '@/components/ui/RouteCard';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { beginNavigation } from '@/features/navigation/session';
import { useDrivingRoutes } from '@/features/routing/useDrivingRoutes';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { errorMessage } from '@/utils/errors';
import { formatDistance, formatDuration } from '@/utils/format';

export default function RoutesScreen() {
  const focused = useIsFocused();
  useForegroundLocation(focused, 'browse');
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AeraMapHandle>(null);
  const units = usePreferencesStore((state) => state.units);
  const location = useLocationStore((state) => state.current);
  const destination = useSessionStore((state) => state.destination);
  const routes = useSessionStore((state) => state.routes);
  const route = useSessionStore((state) => selectedRoute(state));
  const selectRoute = useSessionStore((state) => state.selectRoute);
  const query = useDrivingRoutes(Boolean(focused && destination && location));
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!route) return;
    mapRef.current?.fit(route.geometry);
  }, [route]);

  async function start() {
    setStarting(true);
    try {
      await beginNavigation();
      router.push('/navigation');
    } catch (error) {
      Alert.alert('Navigation did not start', errorMessage(error));
    } finally {
      setStarting(false);
    }
  }

  if (!destination) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title="Choose a destination" message="Search for a place, then compare routes." actionLabel="Search" onAction={() => router.replace('/search')} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <AeraMap
        ref={mapRef}
        user={location}
        destination={destination}
        routes={routes.map((item) => ({ id: item.id, coordinates: item.geometry, selected: item.id === route?.id }))}
      />
      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />
      </View>
      <View style={[styles.sheet, { backgroundColor: theme.colors.background, paddingBottom: insets.bottom + 12 }]}>
        {query.isFetching && routes.length === 0 ? <LoadingState title="Comparing routes" message="Calculating distance and time." /> : null}
        {query.isError && routes.length === 0 ? (
          <ErrorState title="Route unavailable" message={errorMessage(query.error)} actionLabel="Try again" onAction={() => void query.refetch()} />
        ) : null}
        {routes.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
              {routes.map((item) => (
                <RouteCard
                  key={item.id}
                  label={item.label}
                  duration={formatDuration(item.durationSeconds)}
                  detail={formatDistance(item.distanceMeters, units)}
                  summary={item.summary}
                  active={item.id === route?.id}
                  onPress={() => selectRoute(item.id)}
                />
              ))}
            </ScrollView>
            <PrimaryButton icon={Navigation} disabled={!route || starting} onPress={() => void start()} style={styles.start}>
              {starting ? 'Starting…' : 'Start navigation'}
            </PrimaryButton>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  back: { position: 'absolute', left: 16 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16 },
  cards: { gap: 12, paddingHorizontal: 16 },
  start: { marginHorizontal: 16, marginTop: 12 },
});
