import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { arahPolicyUrls, signInToArah } from '@/services/auth/account';
import { signInWithGoogle } from '@/services/auth/google';
import { registerArahNotifications } from '@/services/notifications/register';
import { useT } from '@/i18n';
import { font } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { errorMessage } from '@/utils/errors';

export default function SignInScreen() {
  const theme = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signInToArah(mode, email.trim(), password);
      void registerArahNotifications().catch(() => undefined);
      router.replace('/');
    } catch (caught) {
      setError(errorMessage(caught, t('sign.failed')));
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top + 28 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <AppText size={34} weight="semibold">
          {t('sign.title')}
        </AppText>
        <AppText size={15} color={theme.colors.mutedForeground} style={styles.copy}>
          {mode === 'login' ? t('sign.loginCopy') : t('sign.registerCopy')}
        </AppText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={theme.colors.mutedForeground}
          style={[styles.input, { color: theme.colors.foreground, backgroundColor: theme.colors.nav, borderColor: `${theme.colors.primary}66`, fontFamily: font.medium }]}
          accessibilityLabel="Email"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={theme.colors.mutedForeground}
          style={[styles.input, { color: theme.colors.foreground, backgroundColor: theme.colors.nav, borderColor: `${theme.colors.primary}66`, fontFamily: font.medium }]}
          accessibilityLabel="Password"
        />
        {error ? <AppText size={14}>{error}</AppText> : null}
        <PrimaryButton disabled={pending || email.trim().length === 0 || password.length < 10} onPress={() => void submit()}>
          {pending ? t('common.wait') : mode === 'login' ? t('sign.signIn') : t('sign.create')}
        </PrimaryButton>
        <PrimaryButton
          disabled={pending}
          onPress={() => {
            void (async () => {
              if (pending) return;
              setPending(true);
              setError(null);
              try {
                const signedIn = await signInWithGoogle();
                if (!signedIn) return;
                void registerArahNotifications().catch(() => undefined);
                router.replace('/');
              } catch (caught) {
                setError(errorMessage(caught, t('sign.googleFailed')));
              } finally {
                setPending(false);
              }
            })();
          }}
        >
          {t('sign.google')}
        </PrimaryButton>
        <PrimaryButton
          disabled={pending}
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? t('sign.needAccount') : t('sign.haveAccount')}
        </PrimaryButton>
        <View style={styles.policies}>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(arahPolicyUrls.privacy)}>
            <AppText size={13} color={theme.colors.mutedForeground}>
              {t('profile.privacyPolicy')}
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(arahPolicyUrls.terms)}>
            <AppText size={13} color={theme.colors.mutedForeground}>
              {t('privacy.terms')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  copy: { lineHeight: 22 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontSize: 15 },
  policies: { flexDirection: 'row', gap: 16 },
});
