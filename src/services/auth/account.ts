import { aeraApiRequest } from '@/services/api/client';
import { useAccountStore } from '@/store/sessionAuthStore';
import { useTripStore } from '@/store/tripStore';

export const arahPolicyUrls = {
  privacy: 'https://arahmap.online/privacy',
  terms: 'https://arahmap.online/terms',
  deletion: 'https://arahmap.online/account-deletion',
} as const;

export async function signInToArah(mode: 'login' | 'register', email: string, password: string): Promise<void> {
  const payload = await aeraApiRequest(mode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  saveSession(payload, email.trim().toLowerCase());
}

export async function signInWithGoogleToken(idToken: string, email: string): Promise<void> {
  const payload = await aeraApiRequest('/api/v1/auth/google', {
    method: 'POST',
    body: { idToken },
  });
  saveSession(payload, email.trim().toLowerCase());
}

function saveSession(payload: unknown, fallbackEmail: string): void {
  if (!payload || typeof payload !== 'object') throw new Error('Sign-in returned an unexpected response.');
  const body = payload as { token?: unknown; user?: { email?: unknown } };
  if (typeof body.token !== 'string' || !body.token) throw new Error('Sign-in returned an unexpected response.');
  const accountEmail = typeof body.user?.email === 'string' ? body.user.email : fallbackEmail;
  useAccountStore.getState().setSession(body.token, accountEmail);
}

export async function deleteArahAccount(): Promise<void> {
  await aeraApiRequest('/api/v1/users/me', { method: 'DELETE' });
  useAccountStore.getState().clearSession();
  await useTripStore.getState().clearHistory();
}
