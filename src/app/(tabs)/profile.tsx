import { useRouter } from 'expo-router';
import { ChevronRight, History, Info, MapPin, Settings2, ShieldCheck, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { MetricCard } from '@/components/ui/MetricCard';
import { MetricGrid } from '@/components/ui/MetricGrid';
import { arahPolicyUrls, deleteArahAccount } from '@/services/auth/account';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useAccountStore } from '@/store/sessionAuthStore';
import { useTripStore } from '@/store/tripStore';
import { errorMessage } from '@/utils/errors';
import { radius } from '@/theme';
import { useResponsive } from '@/theme/useResponsive';
import { useTheme } from '@/theme/useTheme';
import { formatDistance, formatDuration } from '@/utils/format';

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { compact, gutter, maxContent, tabClearance } = useResponsive();
  const units = usePreferencesStore((state) => state.units);
  const trips = useTripStore((state) => state.trips);
  const distance = trips.reduce((sum, trip) => sum + trip.distanceMeters, 0);
  const duration = trips.reduce((sum, trip) => sum + trip.durationSeconds, 0);
  const average = trips.length > 0 ? distance / trips.length : 0;
  const email = useAccountStore((state) => state.email);
  const token = useAccountStore((state) => state.token);

  function confirmDeleteAccount() {
    Alert.alert('Delete Arah account?', 'This removes the account on the Arah server and the trip history on this phone. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: () => {
          void deleteArahAccount()
            .then(() => Alert.alert('Account deleted', 'The Arah account and the trip history on this phone have been removed.'))
            .catch((caught: unknown) => Alert.alert('Account was not deleted', errorMessage(caught, 'Try again.')));
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + tabClearance }]}
    >
      <View style={[styles.headerBand, { backgroundColor: theme.colors.surface, paddingTop: insets.top + (compact ? 16 : 24) }]}>
        <View style={[styles.column, { maxWidth: maxContent, paddingHorizontal: gutter }]}>
          <View style={[styles.avatar, compact && styles.avatarCompact, { backgroundColor: `${theme.colors.primary}22` }]}>
            <UserRound color={theme.colors.primary} size={compact ? 26 : 32} />
          </View>
          <AppText size={compact ? 26 : 30} weight="semibold" style={styles.name} numberOfLines={2}>
            {email && token ? email : 'Arah'}
          </AppText>
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.subtitle}>
            {email && token ? 'Signed in. Trip history stays on this phone.' : 'Trip history stays on this phone.'}
          </AppText>
        </View>
      </View>
      <View style={[styles.column, { maxWidth: maxContent, paddingHorizontal: gutter }]}>
        <MetricGrid style={styles.metrics}>
          <MetricCard label="Distance" value={formatDistance(distance, units)} />
          <MetricCard label="Trips" value={String(trips.length)} />
          <MetricCard label="Time" value={formatDuration(duration)} />
          <MetricCard label="Average" value={formatDistance(average, units)} />
        </MetricGrid>
      <View style={[styles.list, { backgroundColor: theme.colors.surface }]}>
        <Row icon={History} label="Trip history" onPress={() => router.push('/trips')} />
        <Row icon={ShieldCheck} label="Privacy" onPress={() => router.push('/privacy')} />
        <Row icon={Info} label="Privacy policy" onPress={() => void Linking.openURL(arahPolicyUrls.privacy)} />
        <Row icon={Info} label="Terms of use" onPress={() => void Linking.openURL(arahPolicyUrls.terms)} />
        <Row icon={MapPin} label="Location access" onPress={() => router.push('/permission')} />
        <Row icon={Settings2} label="Settings" onPress={() => router.push('/settings')} />
        {token ? <Row icon={UserRound} label="Delete account" onPress={confirmDeleteAccount} /> : null}
      </View>
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
        <AppText size={15} weight="medium" numberOfLines={2}>
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
  content: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', alignSelf: 'center' },
  headerBand: { width: '100%', paddingBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarCompact: { width: 60, height: 60, borderRadius: 18 },
  name: { marginTop: 16 },
  subtitle: { marginTop: 6, lineHeight: 20 },
  metrics: { marginTop: 16 },
  list: { borderRadius: radius.md, paddingHorizontal: 16 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
});
