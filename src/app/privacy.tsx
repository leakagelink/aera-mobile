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
    Alert.alert('Safar ki list mita dein?', 'Is phone par save safar hat jayenge.', [
      { text: 'Rehne do', style: 'cancel' },
      { text: 'Mitao', style: 'destructive', onPress: () => void clearHistory() },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert('Arah account mita dein?', 'Server wala account aur is phone ki trip list hat jayegi. Wapas nahi aayegi.', [
      { text: 'Rehne do', style: 'cancel' },
      {
        text: 'Account mitao',
        style: 'destructive',
        onPress: () => {
          void deleteArahAccount()
            .then(() => Alert.alert('Account mit gaya', 'Arah account aur is phone ki trip list hat gayi.'))
            .catch((caught: unknown) => Alert.alert('Account nahi mita', errorMessage(caught, 'Dobara try karo.')));
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Privacy aur location" subtitle="Sirf app khuli ho tab" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.secondary }]}>
          <ShieldCheck color={theme.colors.success} size={28} />
          <AppText size={24} weight="semibold" style={styles.heroTitle}>
            Location tab chalti hai jab app khuli ho.
          </AppText>
          <AppText size={14} color={theme.colors.mutedForeground} style={styles.copy}>
            Arah location sirf tab use karta hai jab app khuli ho. Safar is phone par rehta hai. Account par aapka email Arah server par rehta hai. Google sign-in par Google account id bhi rehti hai. Notification on karo to is phone ka notification token save hota hai, taaki Arah is phone par message bhej sake.
          </AppText>
        </View>
        <Info title="Account" detail={email && token ? `Sign in: ${email}.` : 'Sign in nahi hai. Mausam aur assistant ke liye Arah account chahiye.'} />
        <Info title="Location" detail={permission === 'granted' ? (watching ? 'Is screen par on hai' : 'Ijaza hai, abhi nahi chal rahi') : permission === 'denied' ? 'Mana hai' : 'Abhi nahi maangi'} />
        <Info title="Background location" detail="Use nahi hoti. App band ya background mein Arah aapko track nahi karta." />
        <Info title="Safar" detail="Safar is phone par rehte hain. Account mitane par usi phone ki trip list bhi hatt jaati hai jisse aap mitaate ho." />
        <Info title="Doosri services" detail="Map tiles OpenFreeMap se aate hain. Jagah Nominatim se. Rasta OSRM se. Mausam OpenWeather se, Arah ke through. Assistant Google Gemini use karta hai, aur agar Gemini jawab na de to Relay Models DeepSeek. Awaaz, jab aap use karo, ElevenLabs ko jaati hai aur save nahi hoti. Bachayi chat tab tak rehti hai jab tak aap mitao. Traffic, jab mile, TomTom se aata hai. Google sign-in aapka Google account use karta hai. Notification Firebase Cloud Messaging use karti hai. Arah ads nahi dikhata." />
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
            Phone ki location setting
          </AppText>
        </Pressable>
        {token ? (
          <Pressable accessibilityRole="button" onPress={confirmDeleteAccount} style={[styles.action, { backgroundColor: `${theme.colors.error}14` }]}>
            <AppText size={15} weight="semibold" color={theme.colors.error}>
              Account mitao
            </AppText>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={confirmClear} style={[styles.action, { backgroundColor: `${theme.colors.error}14` }]}>
          <AppText size={15} weight="semibold" color={theme.colors.error}>
            Safar ki list mitao
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
