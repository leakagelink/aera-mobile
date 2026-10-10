import { useRouter } from 'expo-router';
import { LocateFixed, Square, Volume2, VolumeX } from 'lucide-react-native';
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
import { shareEta } from '@/features/navigation/shareEta';
import { useSpokenGuidance } from '@/features/navigation/useSpokenGuidance';
import { useRouteTraffic } from '@/features/traffic/useRouteTraffic';
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
  const [follow, setFollow] = useState(false);
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
  const paused = Boolean(draft?.pausedAt);

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
    if (!location || !destination || paused) return;
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
    const session = useSessionStore.getState();
    const request = now;
    setRouteNote('Naya rasta nikal raha hoon…');
    void routingProvider()
      .calculateRoute(location, destination, undefined, session.travelMode, {
        avoidTolls: session.avoidTolls,
        avoidHighways: session.avoidHighways,
      })
      .then((routes) => {
        if (lastReroute.current !== request) return;
        if (routes.length === 0) {
          setRouteNote('Naya rasta nahi mila.');
          return;
        }
        useSessionStore.getState().setRoutes(routes);
        setRouteNote(routes[0]?.limitNote ?? null);
      })
      .catch(() => {
        if (lastReroute.current === request) setRouteNote('Rasta dobara nahi nikla. Connection dekho.');
      });
  }, [offRoute, location, destination, now, paused]);

  const openedRoute = useRef(false);
  useEffect(() => {
    if (!route || openedRoute.current) return;
    openedRoute.current = true;
    setFollow(false);
    mapRef.current?.fit(route.geometry);
  }, [route]);

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
      Alert.alert('Trip save nahi hui', errorMessage(error));
      setEnding(false);
    }
  }

  function confirmEnd() {
    Alert.alert('Trip khatam karein?', 'Shuru se ab tak ka safar save ho jayega.', [
      { text: 'Chalte raho', style: 'cancel' },
      { text: 'Trip khatam', style: 'destructive', onPress: () => void finish() },
    ]);
  }

  useEffect(() => {
    confirmRef.current = confirmEnd;
  });

  const arrived = snapshot ? hasArrived(snapshot.remainingMeters, snapshot.offRoute, location?.accuracy ?? null) : false;
  const warning = location ? gpsWarning(location.accuracy, now - location.timestamp) : 'GPS signal nahi mil raha. Nayi location ka intezaar hai.';
  const voice = useSpokenGuidance(!paused, snapshot && destination ? {
    arrived,
    offRoute: snapshot.offRoute,
    distanceMeters: snapshot.instructionDistanceMeters,
    maneuverType: snapshot.maneuverType,
    maneuverModifier: snapshot.maneuverModifier,
    roadName: snapshot.roadName,
    destinationName: destination.name,
  } : null);
  const traffic = useRouteTraffic(route?.geometry);
  const arrivedTold = useRef(false);
  useEffect(() => {
    if (!arrived || !destination || arrivedTold.current) return;
    arrivedTold.current = true;
    Alert.alert('Pahunch gaye', destination.name);
  }, [arrived, destination]);

  if (!route || !destination) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title="Navigation chalu nahi hai" message="Pehle rasta chuno, phir trip shuru karo." actionLabel="Map par wapas" onAction={() => router.replace('/map')} />
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
        traffic={traffic.lines}
        onUserGesture={() => setFollow(false)}
      />
      <View style={[styles.instruction, { top: insets.top + 8 }]}>
        <NavigationInstruction
          instruction={arrived ? 'Pahunch gaye' : (snapshot?.instruction ?? 'Seedha chalte raho')}
          distance={arrived ? destination.name : formatDistance(snapshot?.instructionDistanceMeters ?? route.distanceMeters, units)}
          following={arrived ? undefined : snapshot?.followingInstruction}
          modifier={snapshot?.maneuverModifier}
          maneuverType={snapshot?.maneuverType}
        />
        <View style={[styles.note, { backgroundColor: theme.colors.nav }]}>
          <AppText size={13} weight="semibold">
            Manzil: {destination.name}
          </AppText>
          <AppText size={12} color={theme.colors.mutedForeground}>
            {follow ? 'Neeli rekha wahi sadak hai. Us par chalte raho.' : 'Poora rasta dikh raha hai. Apni jagah ke saath chalne ke liye neela button dabao.'}
          </AppText>
        </View>
        {warning ? (
          <View style={[styles.note, { backgroundColor: theme.colors.nav }]}>
            <AppText size={13} weight="medium">
              {warning}
            </AppText>
          </View>
        ) : null}
        {voice.note ? (
          <View style={[styles.note, { backgroundColor: theme.colors.nav }]}>
            <AppText size={13} weight="medium">
              {voice.note}
            </AppText>
          </View>
        ) : null}
        {traffic.note ? (
          <View style={[styles.note, { backgroundColor: theme.colors.nav }]}>
            <AppText size={13} weight="medium">
              {traffic.note}
            </AppText>
          </View>
        ) : null}
        {route.limitNote ? (
          <View style={[styles.note, { backgroundColor: theme.colors.nav }]}>
            <AppText size={13} weight="medium">
              {route.limitNote}
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
        <IconButton icon={voice.muted ? VolumeX : Volume2} label={voice.muted ? 'Awaaz chalu karo' : 'Awaaz band karo'} primary={!voice.muted} onPress={voice.toggleMuted} />
        <IconButton icon={LocateFixed} label="Meri jagah follow karo" primary={follow} onPress={() => setFollow(true)} />
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
        <BottomSheet expanded={expanded} onExpandedChange={setExpanded}>
          {expanded && live ? (
            <View style={styles.metrics}>
              <MetricCard compact label="Average" value={formatSpeed(live.averageSpeedMps, units)} unit={speedUnit(units)} />
              <MetricCard compact label="Chala" value={formatDistance(live.distanceMeters, units)} />
              <MetricCard compact label="Kul time" value={formatDuration(live.durationSeconds)} />
            <MetricCard compact label="Chalte" value={formatDuration(live.movingTimeSeconds)} />
            <MetricCard compact label="Ruke" value={formatDuration(live.stoppedTimeSeconds)} />
            </View>
          ) : null}
          <View style={styles.primaryMetrics}>
            <Stat value={snapshot ? formatClock(snapshot.eta) : '—'} label={snapshot ? `Pahunch · ${formatDuration(snapshot.remainingSeconds)}` : 'Pahunch'} />
            <Stat value={snapshot ? formatDistance(snapshot.remainingMeters, units) : '—'} label="baaki" />
            <Stat value={formatSpeed(location?.speed ?? null, units)} label={speedUnit(units)} />
          </View>
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <LocationStatus recording />
            <Pressable
              accessibilityRole="button"
              onPress={() => void (paused ? useTripStore.getState().resumeDraft() : useTripStore.getState().pauseDraft())}
              style={[styles.end, { backgroundColor: theme.colors.secondary }]}
            >
              <AppText size={14} weight="semibold">
                {paused ? 'Chalu' : 'Ruko'}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!snapshot}
              onPress={() => {
                if (!snapshot) return;
                void shareEta({
                  destination: destination.name,
                  seconds: snapshot.remainingSeconds,
                  meters: snapshot.remainingMeters,
                  units,
                  arrived,
                });
              }}
              style={[styles.end, { backgroundColor: theme.colors.secondary, opacity: snapshot ? 1 : 0.5 }]}
            >
              <AppText size={14} weight="semibold">
                ETA bhejo
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirmEnd} style={[styles.end, { backgroundColor: `${theme.colors.error}1F` }]}>
              <Square color={theme.colors.error} size={12} fill={theme.colors.error} />
              <AppText size={14} weight="semibold" color={theme.colors.error}>
                {ending ? 'Save ho raha hai…' : 'Trip khatam'}
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
  recenter: { position: 'absolute', right: 16, top: '46%', gap: 10 },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 0 },
  metrics: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  primaryMetrics: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  stat: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  end: { height: 40, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
});
