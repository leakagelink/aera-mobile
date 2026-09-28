import { env } from '@/services/env';
import { requestJson } from '@/services/http';
import { useAccountStore } from '@/store/sessionAuthStore';
import { AppError } from '@/utils/errors';

export type AeraApiMode = 'direct-providers' | 'aera-api';

export function aeraApiMode(): AeraApiMode {
  return env.aeraApiBaseUrl ? 'aera-api' : 'direct-providers';
}

export function aeraApiBaseUrl(): string | null {
  return env.aeraApiBaseUrl;
}

export async function aeraApiRequest(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal; timeoutMs?: number }): Promise<unknown> {
  const baseUrl = env.aeraApiBaseUrl;
  if (!baseUrl) {
    throw new AppError('The Arah API is not configured. Search and routing stay on the direct development providers.', 'unavailable');
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = useAccountStore.getState().token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await requestJson(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
      headers,
      signal: init?.signal,
      method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      timeoutMs: init?.timeoutMs,
    });
  } catch (error) {
    if (error instanceof AppError && error.message === 'Sign in to continue.') useAccountStore.getState().clearSession();
    throw error;
  }
}
