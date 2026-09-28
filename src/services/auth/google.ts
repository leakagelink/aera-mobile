import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

import { signInWithGoogleToken } from '@/services/auth/account';

export async function signInWithGoogle(): Promise<boolean> {
  const webClientId = googleWebClientId();
  if (!webClientId) throw new Error('Google sign-in is not configured in this build.');
  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return false;
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Google did not return a sign-in token.');
    await signInWithGoogleToken(idToken, response.data.user.email);
    return true;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return false;
    throw error;
  }
}

function googleWebClientId(): string | null {
  const extra = Constants.expoConfig?.extra as { googleWebClientId?: unknown } | undefined;
  return typeof extra?.googleWebClientId === 'string' && extra.googleWebClientId.length > 0 ? extra.googleWebClientId : null;
}
