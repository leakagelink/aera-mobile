import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { usualDestinations } from '@/features/trips/habits';
import { routingProvider } from '@/services/providers';
import { useHabitStore } from '@/store/habitStore';
import { useSessionStore } from '@/store/sessionStore';
import { radius } from '@/theme';
import { useT } from '@/i18n';
import { useTheme } from '@/theme/useTheme';
import type { GeoLocation } from '@/types/location';
import { formatDuration } from '@/utils/format';

export function UsualRouteCard({ location }: { location: GeoLocation | null }) {
  const theme = useTheme();
  const { t } = useT();
  const router = useRouter();
  const places = useHabitStore((state) => state.places);
  const legs = useHabitStore((state) => state.legs);
  const ready = useHabitStore((state) => state.ready);
  const [times, setTimes] = useState<{ fastest: number; other: number | null } | null>(null);

  const suggestion = location && ready ? usualDestinations(places, legs, location)[0] : undefined;

  const targetId = suggestion?.to.id;
  const targetLatitude = suggestion?.to.latitude;
  const targetLongitude = suggestion?.to.longitude;

  const originLatitude = location ? Number(location.latitude.toFixed(2)) : null;
  const originLongitude = location ? Number(location.longitude.toFixed(2)) : null;

  useEffect(() => {
    if (originLatitude === null || originLongitude === null || targetLatitude === undefined || targetLongitude === undefined) return;
    let cancelled = false;
    void routingProvider()
      .calculateRoute({ latitude: originLatitude, longitude: originLongitude }, { latitude: targetLatitude, longitude: targetLongitude })
      .then((routes) => {
        if (cancelled || routes.length === 0) return;
        const ordered = [...routes].sort((left, right) => left.durationSeconds - right.durationSeconds);
        const fastest = ordered[0];
        const other = ordered[1];
        if (!fastest) return;
        setTimes({ fastest: fastest.durationSeconds, other: other ? other.durationSeconds : null });
      })
      .catch(() => {
        if (!cancelled) setTimes(null);
      });
    return () => {
      cancelled = true;
    };
  }, [originLatitude, originLongitude, targetId, targetLatitude, targetLongitude]);

  if (!suggestion) return null;

  function go() {
    if (!suggestion) return;
    useSessionStore.getState().setDestination({
      id: suggestion.to.id,
      name: suggestion.to.name,
      address: suggestion.to.name,
      latitude: suggestion.to.latitude,
      longitude: suggestion.to.longitude,
    });
    router.push('/destination');
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
      <AppText size={13} weight="semibold">
        {t('habit.often', { from: suggestion.from.name, to: suggestion.to.name, count: suggestion.trips })}
      </AppText>
      <AppText size={12} color={theme.colors.mutedForeground} style={styles.copy}>
        {times
          ? `${t('habit.fastest', { time: formatDuration(times.fastest) })} ${times.other ? t('habit.other', { time: formatDuration(times.other) }) : ''} ${t('habit.live')}`
          : t('habit.loading')}
      </AppText>
      <Pressable accessibilityRole="button" onPress={go} style={styles.action}>
        <AppText size={13} weight="semibold" color={theme.colors.primary}>
          {t('habit.go')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  copy: { marginTop: 4, lineHeight: 18 },
  action: { marginTop: 8, minHeight: 32, justifyContent: 'center' },
});
