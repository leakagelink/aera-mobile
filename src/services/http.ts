import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { AppError } from '@/utils/errors';

type RequestOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  method?: string;
  body?: string;
};

type HttpResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export async function requestJson(url: string, options: RequestOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await send(url, {
      method: options.method,
      body: options.body,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AppError(
        response.status === 429
          ? 'The map service is busy. Wait a moment and try again.'
          : `The request failed (${response.status}). Try again.`,
        'network',
      );
    }
    return await response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (options.signal?.aborted) {
      throw new AppError('Search was cancelled.', 'network');
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('The request timed out. Check your connection and try again.', 'network');
    }
    throw new AppError('Network unavailable. Check your connection and try again.', 'network');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

async function send(
  url: string,
  init: { method?: string; body?: string; headers: Record<string, string>; signal: AbortSignal },
): Promise<HttpResponse> {
  if (Platform.OS === 'web') {
    return fetch(url, init);
  }
  return expoFetch(url, init) as unknown as Promise<HttpResponse>;
}
