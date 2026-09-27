export type AppErrorCode =
  | 'network'
  | 'nominatim'
  | 'osrm'
  | 'invalid'
  | 'unavailable'
  | 'permission';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(message: string, code: AppErrorCode) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
