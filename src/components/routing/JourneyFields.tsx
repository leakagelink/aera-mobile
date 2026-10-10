import { useRouter } from 'expo-router';
import { ArrowUpDown } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { TravelModeBar } from '@/components/routing/TravelModeBar';
import { AppText } from '@/components/ui/AppText';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export function JourneyFields() {
  const router = useRouter();
  const theme = useTheme();
  const origin = useSessionStore((state) => state.origin);
  const destination = useSessionStore((state) => state.destination);
  const setOrigin = useSessionStore((state) => state.setOrigin);
  const setDestination = useSessionStore((state) => state.setDestination);
  const avoidTolls = useSessionStore((state) => state.avoidTolls);
  const avoidHighways = useSessionStore((state) => state.avoidHighways);
  const setAvoidTolls = useSessionStore((state) => state.setAvoidTolls);
  const setAvoidHighways = useSessionStore((state) => state.setAvoidHighways);
  const limitNote = useSessionStore((state) => selectedRoute(state)?.limitNote ?? null);

  function swap() {
    if (!destination && !origin) return;
    const nextOrigin = destination;
    const nextDestination = origin;
    setOrigin(nextOrigin);
    setDestination(nextDestination);
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
      <View style={styles.fields}>
        <View style={styles.stack}>
          <Endpoint label="Yahan se" value={origin?.name ?? 'Aapki jagah'} onPress={() => router.push({ pathname: '/search', params: { field: 'origin' } })} />
          <View style={[styles.rule, { backgroundColor: theme.colors.glassBorder }]} />
          <Endpoint
            label="Kahan"
            value={destination?.name ?? 'Kahan jana hai?'}
            muted={!destination}
            onPress={() => router.push({ pathname: '/search', params: { field: 'destination' } })}
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Shuru aur manzil badlo" onPress={swap} style={styles.swap}>
          <ArrowUpDown color={theme.colors.primary} size={18} />
        </Pressable>
      </View>
      <TravelModeBar />
      <View style={styles.filters}>
        <FilterChip label="Toll mat lo" active={avoidTolls} onPress={() => setAvoidTolls(!avoidTolls)} />
        <FilterChip label="Highway mat lo" active={avoidHighways} onPress={() => setAvoidHighways(!avoidHighways)} />
      </View>
      {limitNote ? (
        <AppText size={12} color={theme.colors.mutedForeground}>
          {limitNote}
        </AppText>
      ) : null}
      {destination ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/destination')} style={styles.route}>
          <AppText size={13} weight="semibold" color={theme.colors.primary}>
            Rasta dekho
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.colors.primary : theme.colors.background, borderColor: active ? theme.colors.primary : theme.colors.glassBorder }]}
    >
      <AppText size={12} weight="semibold" color={active ? theme.colors.primaryForeground : theme.colors.foreground}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Endpoint({ label, value, muted = false, onPress }: { label: string; value: string; muted?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.endpoint}>
      <AppText size={11} weight="bold" color={theme.colors.mutedForeground} style={styles.label}>
        {label}
      </AppText>
      <AppText size={15} weight="medium" numberOfLines={1} color={muted ? theme.colors.mutedForeground : theme.colors.foreground}>
        {value}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: 12, gap: 10 },
  fields: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stack: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  endpoint: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 62 },
  swap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  route: { alignSelf: 'flex-start' },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
});
