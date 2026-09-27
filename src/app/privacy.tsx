import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useLocationStore } from '@/store/locationStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

export default function PrivacyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const permission = useLocationStore((state) => state.permission);
  const watching = useLocationStore((state) => state.watching);
  const clearHistory = useTripStore((state) => state.clearHistory);

  function confirmClear() {
    Alert.alert('Delete trip history?', 'This removes journeys stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void clearHistory() },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Privacy and location" subtitle="Foreground only" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.secondary }]}>
          <ShieldCheck color={theme.colors.success} size={28} />
          <AppText size={24} weight="semibold" style={styles.heroTitle}>
            Your journey stays on this device.
          </AppText>
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.copy}>
            Aera requests location only while a map or navigation screen is open. A trip is recorded only after you start navigation. There is no account, advertising, or analytics in this version.
          </AppText>
        </View>
        <Info title="Foreground location" detail={permission === 'granted' ? (watching ? 'On while this flow needs it' : 'Allowed, not currently watching') : permission === 'denied' ? 'Denied' : 'Not requested yet'} />
        <Info title="Background location" detail="Not used. Aera does not track you when the app is closed or in the background." />
        <Info title="Trip storage" detail="Samples and metrics are kept in local storage so a later version can sync them if you choose." />
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={[styles.action, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="semibold">
            Open system location settings
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={confirmClear} style={[styles.action, { backgroundColor: `${theme.colors.error}14` }]}>
          <AppText size={15} weight="semibold" color={theme.colors.error}>
            Delete trip history
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Info({ title, detail }: { title: string; detail: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.info, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText size={15} weight="semibold">
        {title}
      </AppText>
      <AppText size={13} color={theme.colors.mutedForeground} style={styles.copy}>
        {detail}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  hero: { borderRadius: radius.xl, padding: 20 },
  heroTitle: { marginTop: 16 },
  copy: { marginTop: 8, lineHeight: 20 },
  info: { marginTop: 12, borderRadius: radius.md, borderWidth: 1, padding: 16 },
  action: { marginTop: 12, minHeight: 56, borderRadius: radius.md, justifyContent: 'center', paddingHorizontal: 16 },
});
