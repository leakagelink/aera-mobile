import { env } from '@/services/env';
import { requestJson } from '@/services/http';
import { AppError } from '@/utils/errors';

export type AeraApiMode = 'direct-providers' | 'aera-api';

export function aeraApiMode(): AeraApiMode {
  return env.aeraApiBaseUrl ? 'aera-api' : 'direct-providers';
}

export function aeraApiBaseUrl(): string | null {
  return env.aeraApiBaseUrl;
}

export async function aeraApiRequest(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<unknown> {
  const baseUrl = env.aeraApiBaseUrl;
  if (!baseUrl) {
    throw new AppError('The Aera API is not configured. Search and routing stay on the direct development providers.', 'unavailable');
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  return requestJson(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    headers,
    signal: init?.signal,
    method: init?.method ?? (init?.body === undefined ? 'GET' : 'POST'),
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
