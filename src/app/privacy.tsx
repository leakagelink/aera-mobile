import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useT } from '@/i18n';
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
  const { t } = useT();
  const permission = useLocationStore((state) => state.permission);
  const watching = useLocationStore((state) => state.watching);
  const clearHistory = useTripStore((state) => state.clearHistory);
  const email = useAccountStore((state) => state.email);
  const token = useAccountStore((state) => state.token);

  function confirmClear() {
    Alert.alert(t('settings.clearTitle'), t('privacy.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void clearHistory() },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: () => {
          void deleteArahAccount()
            .then(() => Alert.alert(t('profile.deletedTitle'), t('profile.deletedBody')))
            .catch((caught: unknown) => Alert.alert(t('profile.deleteFailed'), errorMessage(caught, t('profile.tryAgain'))));
        },
      },
    ]);
  }

  const locationDetail =
    permission === 'granted' ? (watching ? t('privacy.locationOn') : t('privacy.locationIdle')) : permission === 'denied' ? t('privacy.locationDenied') : t('privacy.locationUnasked');

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title={t('privacy.title')} subtitle={t('privacy.subtitle')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.secondary }]}>
          <ShieldCheck color={theme.colors.success} size={28} />
          <AppText size={24} weight="semibold" style={styles.heroTitle}>
            {t('privacy.heroTitle')}
          </AppText>
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.copy}>
            {t('privacy.heroBody')}
          </AppText>
        </View>
        <Info title={t('privacy.account')} detail={email && token ? t('privacy.signedIn', { email }) : t('privacy.signedOut')} />
        <Info title={t('privacy.location')} detail={locationDetail} />
        <Info title={t('privacy.screenOffTitle')} detail={t('privacy.screenOffBody')} />
        <Info title={t('profile.tripList')} detail={t('privacy.trips')} />
        <Info title={t('privacy.servicesTitle')} detail={t('privacy.services')} />
        <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(arahPolicyUrls.privacy)} style={[styles.action, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="semibold">
            {t('profile.privacyPolicy')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(arahPolicyUrls.terms)} style={[styles.action, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="semibold">
            {t('privacy.terms')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={[styles.action, { backgroundColor: theme.colors.surface }]}>
          <AppText size={15} weight="semibold">
            {t('privacy.phoneSettings')}
          </AppText>
        </Pressable>
        {token ? (
          <Pressable accessibilityRole="button" onPress={confirmDeleteAccount} style={[styles.action, { backgroundColor: `${theme.colors.error}14` }]}>
            <AppText size={15} weight="semibold" color={theme.colors.error}>
              {t('profile.deleteAccount')}
            </AppText>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={confirmClear} style={[styles.action, { backgroundColor: `${theme.colors.error}14` }]}>
          <AppText size={15} weight="semibold" color={theme.colors.error}>
            {t('privacy.clear')}
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
