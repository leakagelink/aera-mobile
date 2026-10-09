import { useRouter } from 'expo-router';
import { LocateFixed, Square } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { LocationStatus } from '@/components/ui/LocationStatus';
import { MetricCard } from '@/components/ui/MetricCard';
import { NavigationInstruction } from '@/components/ui/NavigationInstruction';
import { ErrorState } from '@/components/ui/States';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { gpsWarning, hasArrived, rerouteDecision } from '@/features/navigation/reroute';
import { navigationSnapshot } from '@/features/navigation/progress';
import { completeNavigation } from '@/features/navigation/session';
import { routingProvider } from '@/services/providers';
import { computeTripMetrics } from '@/features/trips/metrics';
import { useTripRecorder } from '@/features/trips/useTripRecorder';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { errorMessage } from '@/utils/errors';
import { formatClock, formatDistance, formatDuration, formatSpeed, speedUnit } from '@/utils/format';

export default function NavigationScreen() {
  useForegroundLocation(true, 'navigate');
  useTripRecorder(true);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AeraMapHandle>(null);
  const [follow, setFollow] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [ending, setEnding] = useState(false);
  const [routeNote, setRouteNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const offSince = useRef<number | null>(null);
  const lastReroute = useRef<number | null>(null);
  const units = usePreferencesStore((state) => state.units);
  const location = useLocationStore((state) => state.current);
  const destination = useSessionStore((state) => state.destination);
  const route = useSessionStore((state) => selectedRoute(state));
  const draft = useTripStore((state) => state.draft);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const snapshot = useMemo(() => {
    if (!location || !route) return null;
    return navigationSnapshot(location, location.speed, route, now);
  }, [location, route, now]);

  const live = useMemo(() => {
    if (!draft) return null;
    return computeTripMetrics(draft.samples, draft.startedAt, now);
  }, [draft, now]);

  const offRoute = snapshot?.offRoute ?? false;
  useEffect(() => {
    if (!location || !destination) return;
    const decision = rerouteDecision({
      offRoute,
      accuracy: location.accuracy,
      locationAgeMs: now - location.timestamp,
      offSince: offSince.current,
      now,
      lastAttemptAt: lastReroute.current,
    });
    offSince.current = decision.offSince;
    if (!decision.attempt) return;
    lastReroute.current = now;
    const mode = useSessionStore.getState().travelMode;
    const request = now;
    setRouteNote('Recalculating the route…');
    void routingProvider()
      .calculateRoute(location, destination, undefined, mode)
      .then((routes) => {
        if (lastReroute.current !== request) return;
        if (routes.length === 0) {
          setRouteNote('A new route is not available.');
          return;
        }
        useSessionStore.getState().setRoutes(routes);
        setRouteNote(null);
      })
      .catch(() => {
        if (lastReroute.current === request) setRouteNote('The route could not be recalculated. Check the connection.');
      });
  }, [offRoute, location, destination, now]);

  useEffect(() => {
    if (!follow || !location) return;
    const bearing = location.heading !== null && location.heading >= 0 ? location.heading : undefined;
    mapRef.current?.recenter(location.longitude, location.latitude, 16.5, bearing);
  }, [follow, location]);

  const confirmRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  async function finish() {
    if (ending) return;
    setEnding(true);
    try {
      await completeNavigation();
      router.replace('/trip-complete');
    } catch (error) {
      Alert.alert('Trip was not saved', errorMessage(error));
      setEnding(false);
    }
  }

  function confirmEnd() {
    Alert.alert('End this trip?', 'Arah will save the journey recorded since you started.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End trip', style: 'destructive', onPress: () => void finish() },
    ]);
  }

  useEffect(() => {
    confirmRef.current = confirmEnd;
  });

  const arrived = snapshot ? hasArrived(snapshot.remainingMeters, snapshot.offRoute, location?.accuracy ?? null) : false;
  const warning = location ? gpsWarning(location.accuracy, now - location.timestamp) : 'GPS signal lost. Waiting for a new location.';

  if (!route || !destination) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title="Navigation is not active" message="Choose a route before starting a trip." actionLabel="Back to map" onAction={() => router.replace('/map')} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <AeraMap
        ref={mapRef}
        user={location}
        destination={destination}
        routes={[{ id: route.id, coordinates: route.geometry, selected: true }]}
        onUserGesture={() => setFollow(false)}
      />
      <View style={[styles.instruction, { top: insets.top + 8 }]}>
        <NavigationInstruction
          instruction={arrived ? 'You have arrived' : (snapshot?.instruction ?? 'Continue on the route')}
          distance={arrived ? destination.name : formatDistance(snapshot?.instructionDistanceMeters ?? route.distanceMeters, units)}
          following={arrived ? undefined : snapshot?.followingInstruction}
          modifier={snapshot?.maneuverModifier}
          maneuverType={snapshot?.maneuverType}
        />
        {warning ? (
          <View style={[styles.note, { backgroundColor: theme.colors.nav }]}>
            <AppText size={13} weight="medium">
              {warning}
            </AppText>
          </View>
        ) : null}
        {routeNote ? (
          <View style={[styles.note, { backgroundColor: theme.colors.nav }]}>
            <AppText size={13} weight="medium">
              {routeNote}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.recenter}>
        <IconButton icon={LocateFixed} label="Follow my location" primary={follow} onPress={() => setFollow(true)} />
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
        <BottomSheet expanded={expanded} onExpandedChange={setExpanded}>
          {expanded && live ? (
            <View style={styles.metrics}>
              <MetricCard compact label="Average" value={formatSpeed(live.averageSpeedMps, units)} unit={speedUnit(units)} />
              <MetricCard compact label="Traveled" value={formatDistance(live.distanceMeters, units)} />
              <MetricCard compact label="Elapsed" value={formatDuration(live.durationSeconds)} />
            <MetricCard compact label="Moving" value={formatDuration(live.movingTimeSeconds)} />
            <MetricCard compact label="Stopped" value={formatDuration(live.stoppedTimeSeconds)} />
            </View>
          ) : null}
          <View style={styles.primaryMetrics}>
            <Stat value={snapshot ? formatClock(snapshot.eta) : '—'} label={snapshot ? `ETA · ${formatDuration(snapshot.remainingSeconds)}` : 'ETA'} />
            <Stat value={snapshot ? formatDistance(snapshot.remainingMeters, units) : '—'} label="remaining" />
            <Stat value={formatSpeed(location?.speed ?? null, units)} label={speedUnit(units)} />
          </View>
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <LocationStatus recording />
            <Pressable accessibilityRole="button" onPress={confirmEnd} style={[styles.end, { backgroundColor: `${theme.colors.error}1F` }]}>
              <Square color={theme.colors.error} size={12} fill={theme.colors.error} />
              <AppText size={14} weight="semibold" color={theme.colors.error}>
                {ending ? 'Saving…' : 'End trip'}
              </AppText>
            </Pressable>
          </View>
        </BottomSheet>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <AppText size={28} weight="semibold" tabular>
        {value}
      </AppText>
      <AppText size={12} color={theme.colors.mutedForeground}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  instruction: { position: 'absolute', left: 12, right: 12, gap: 8 },
  note: { marginTop: 8, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  recenter: { position: 'absolute', right: 16, top: '46%' },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 0 },
  metrics: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  primaryMetrics: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  stat: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  end: { height: 40, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
});
