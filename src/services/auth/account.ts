import { aeraApiRequest } from '@/services/api/client';
import { useAccountStore } from '@/store/sessionAuthStore';

export async function signInToArah(mode: 'login' | 'register', email: string, password: string): Promise<void> {
  const payload = await aeraApiRequest(mode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!payload || typeof payload !== 'object') throw new Error('Sign-in returned an unexpected response.');
  const body = payload as { token?: unknown; user?: { email?: unknown } };
  if (typeof body.token !== 'string' || !body.token) throw new Error('Sign-in returned an unexpected response.');
  const accountEmail = typeof body.user?.email === 'string' ? body.user.email : email.trim().toLowerCase();
  useAccountStore.getState().setSession(body.token, accountEmail);
}
