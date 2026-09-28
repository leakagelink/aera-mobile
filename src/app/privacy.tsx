import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { arahPolicyUrls, deleteArahAccount } from '@/services/auth/account';
import { useLocationStore } from '@/store/locationStore';
import { useAccountStore } from '@/store/sessionAuthStore';
import { useTripStore } from '@/store/tripStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { errorMessage } from '@/utils/errors';

export default function PrivacyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const permission = useLocationStore((state) => state.permission);
  const watching = useLocationStore((state) => state.watching);
  const clearHistory = useTripStore((state) => state.clearHistory);
  const email = useAccountStore((state) => state.email);
  const token = useAccountStore((state) => state.token);

  function confirmClear() {
    Alert.alert('Delete trip history?', 'This removes journeys stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void clearHistory() },
    ]);
  }

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
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Privacy and location" subtitle="Foreground only" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.secondary }]}>
          <ShieldCheck color={theme.colors.success} size={28} />
          <AppText size={24} weight="semibold" style={styles.heroTitle}>
            Location stays in the foreground.
          </AppText>
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.copy}>
            Arah uses location only while the app is open. Trip history stays on this phone. An account stores your email on the Arah server. Google sign-in also stores the Google account id. If you allow notifications, the notification token for this phone is stored so Arah can message this device.
          </AppText>
        </View>
        <Info title="Account" detail={email && token ? `Signed in as ${email}.` : 'Not signed in. Weather and the assistant need an Arah account.'} />
        <Info title="Foreground location" detail={permission === 'granted' ? (watching ? 'On while this flow needs it' : 'Allowed, not currently watching') : permission === 'denied' ? 'Denied' : 'Not requested yet'} />
        <Info title="Background location" detail="Not used. Arah does not track you when the app is closed or in the background." />
        <Info title="Trip storage" detail="Trips stay on this phone. Deleting the account also clears the trip history on the phone you use to delete it." />
        <Info title="Other services" detail="Map tiles come from OpenFreeMap. Place search uses Nominatim. Routes use OSRM. Weather uses OpenWeather through Arah. The assistant uses Google Gemini. Google sign-in uses your Google account. Notifications use Firebase Cloud Messaging. Arah does not show ads." />
        <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(arahPolicyUrls.privacy)} style={[styles.action, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="semibold">
            Privacy policy
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(arahPolicyUrls.terms)} style={[styles.action, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="semibold">
            Terms of use
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={[styles.action, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="semibold">
            Open system location settings
          </AppText>
        </Pressable>
        {token ? (
          <Pressable accessibilityRole="button" onPress={confirmDeleteAccount} style={[styles.action, { backgroundColor: `${theme.colors.error}14` }]}>
            <AppText size={15} weight="semibold" color={theme.colors.error}>
              Delete account
            </AppText>
          </Pressable>
        ) : null}
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
