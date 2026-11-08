import { copy, t } from '@/i18n';

export type AppErrorCode = 'network' | 'nominatim' | 'osrm' | 'invalid' | 'unavailable' | 'permission';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(message: string, code: AppErrorCode) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function errorMessage(error: unknown, fallback = t('error.generic')): string {
  const raw = error instanceof AppError || error instanceof Error ? error.message : '';
  if (raw) return copy(raw) ?? raw;
  return fallback;
}
