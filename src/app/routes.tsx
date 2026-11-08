import { useIsFocused, useRouter } from 'expo-router';
import { ArrowLeft, Navigation } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { TravelModeBar } from '@/components/routing/TravelModeBar';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { RouteCard } from '@/components/ui/RouteCard';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { limitCopy, routeLabel } from '@/features/routing/instructions';
import { shareEta } from '@/features/navigation/shareEta';
import { useT } from '@/i18n';
import { beginNavigation } from '@/features/navigation/session';
import { useRouteTraffic } from '@/features/traffic/useRouteTraffic';
import { useJourneyRoutes } from '@/features/routing/useJourneyRoutes';
import { useLocationStore } from '@/store/locationStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { errorMessage } from '@/utils/errors';
import { formatDistance, formatDuration } from '@/utils/format';
import { distanceMeters } from '@/utils/geo';

export default function RoutesScreen() {
  const focused = useIsFocused();
  useForegroundLocation(focused, 'browse');
  const router = useRouter();
  const theme = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AeraMapHandle>(null);
  const units = usePreferencesStore((state) => state.units);
  const location = useLocationStore((state) => state.current);
  const origin = useSessionStore((state) => state.origin);
  const destination = useSessionStore((state) => state.destination);
  const routes = useSessionStore((state) => state.routes);
  const route = useSessionStore((state) => selectedRoute(state));
  const traffic = useRouteTraffic(route?.geometry);
  const selectRoute = useSessionStore((state) => state.selectRoute);
  const startPoint = origin ?? location;
  const query = useJourneyRoutes(Boolean(focused && destination && startPoint));
  const awayFromStart = Boolean(origin && location && distanceMeters(location, origin) > 200);
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
      Alert.alert(t('route.failedTitle'), errorMessage(error));
    } finally {
      setStarting(false);
    }
  }

  if (!destination) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
        <ErrorState title={t('route.chooseTitle')} message={t('route.chooseBody')} actionLabel={t('route.search')} onAction={() => router.replace('/search')} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <AeraMap
        ref={mapRef}
        user={location}
        origin={origin}
        destination={destination}
        routes={routes.map((item) => ({ id: item.id, coordinates: item.geometry, selected: item.id === route?.id }))}
        traffic={traffic.lines}
      />
      <View style={[styles.back, { top: insets.top + 8 }]}>
        <IconButton icon={ArrowLeft} label={t('common.back')} onPress={() => router.back()} />
      </View>
      <View style={[styles.sheet, { backgroundColor: theme.colors.background, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.modes}>
          <TravelModeBar />
        </View>
        {query.isFetching && routes.length === 0 ? <LoadingState title={t('route.loadingTitle')} message={t('route.loadingBody')} /> : null}
        {query.isError && routes.length === 0 ? (
          <ErrorState title={t('route.noneTitle')} message={errorMessage(query.error)} actionLabel={t('common.retry')} onAction={() => void query.refetch()} />
        ) : null}
        {routes.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
              {routes.map((item) => (
                <RouteCard
                  key={item.id}
                  label={routeLabel(item.label)}
                  duration={formatDuration(item.durationSeconds)}
                  detail={formatDistance(item.distanceMeters, units)}
                  summary={item.summary}
                  active={item.id === route?.id}
                  onPress={() => selectRoute(item.id)}
                />
              ))}
            </ScrollView>
            {route?.limitNote ? (
              <AppText size={13} color={theme.colors.mutedForeground} style={styles.note}>
                {limitCopy(route.limitNote)}
              </AppText>
            ) : null}
            {traffic.note ? (
              <AppText size={13} color={theme.colors.mutedForeground} style={styles.note}>
                {traffic.note}
              </AppText>
            ) : null}
            {awayFromStart ? (
              <AppText size={13} color={theme.colors.mutedForeground} style={styles.note}>
                {t('route.away', { name: origin?.name ?? '' })}
              </AppText>
            ) : null}
            <PrimaryButton icon={Navigation} disabled={!route || starting || awayFromStart} onPress={() => void start()} style={styles.start}>
              {starting ? t('route.starting') : t('route.start')}
            </PrimaryButton>
            {route && destination ? (
              <SecondaryButton
                style={styles.start}
                onPress={() => void shareEta({ destination: destination.name, seconds: route.durationSeconds, meters: route.distanceMeters, units })}
              >
                {t('map.shareEta')}
              </SecondaryButton>
            ) : null}
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
  modes: { paddingHorizontal: 16, marginBottom: 12 },
  cards: { gap: 12, paddingHorizontal: 16 },
  note: { marginHorizontal: 16, marginTop: 12, lineHeight: 18 },
  start: { marginHorizontal: 16, marginTop: 12 },
});
