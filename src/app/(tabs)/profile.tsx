import { useRouter } from 'expo-router';
import { ChevronRight, History, Info, MapPin, Settings2, ShieldCheck, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { MetricCard } from '@/components/ui/MetricCard';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { formatDistance, formatDuration } from '@/utils/format';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const units = usePreferencesStore((state) => state.units);
  const trips = useTripStore((state) => state.trips);
  const distance = trips.reduce((sum, trip) => sum + trip.distanceMeters, 0);
  const duration = trips.reduce((sum, trip) => sum + trip.durationSeconds, 0);
  const average = trips.length > 0 ? distance / trips.length : 0;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
      <View style={[styles.header, { paddingTop: insets.top + 24, backgroundColor: theme.colors.surface }]}>
        <View style={[styles.avatar, { backgroundColor: `${theme.colors.primary}22` }]}>
          <UserRound color={theme.colors.primary} size={32} />
        </View>
        <AppText size={30} weight="semibold" style={styles.name}>
          Local profile
        </AppText>
        <AppText size={14} color={theme.colors.mutedForeground}>
          No account. Trip history stays on this device.
        </AppText>
      </View>
      <View style={styles.metrics}>
        <MetricCard label="Distance" value={formatDistance(distance, units)} />
        <MetricCard label="Trips" value={String(trips.length)} />
        <MetricCard label="Time" value={formatDuration(duration)} />
        <MetricCard label="Average" value={formatDistance(average, units)} />
      </View>
      <View style={[styles.list, { backgroundColor: theme.colors.surface }]}>
        <Row icon={History} label="Trip history" onPress={() => router.push('/trips')} />
        <Row icon={ShieldCheck} label="Privacy" onPress={() => router.push('/privacy')} />
        <Row icon={MapPin} label="Location access" onPress={() => router.push('/permission')} />
        <Row icon={Settings2} label="Settings" onPress={() => router.push('/settings')} />
        <Row icon={Info} label="About Arah" detail="Phase 1 navigation" />
      </View>
    </ScrollView>
  );
}

function Row({ icon: Icon, label, detail, onPress }: { icon: LucideIcon; label: string; detail?: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.colors.secondary }]}>
        <Icon color={theme.colors.foreground} size={18} />
      </View>
      <View style={styles.rowCopy}>
        <AppText size={15} weight="medium">
          {label}
        </AppText>
        {detail ? (
          <AppText size={12} color={theme.colors.mutedForeground}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {onPress ? <ChevronRight color={theme.colors.mutedForeground} size={16} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 28 },
  avatar: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 18 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 20 },
  list: { marginHorizontal: 20, borderRadius: radius.md, paddingHorizontal: 16 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1 },
});
