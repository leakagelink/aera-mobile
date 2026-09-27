import { HttpException, HttpStatus } from '@nestjs/common';

export type WeatherErrorCode =
  | 'WEATHER_PROVIDER_NOT_CONFIGURED'
  | 'WEATHER_PROVIDER_DISABLED'
  | 'WEATHER_PROVIDER_UNAVAILABLE'
  | 'WEATHER_PROVIDER_AUTH_FAILED'
  | 'WEATHER_PROVIDER_RATE_LIMITED'
  | 'WEATHER_PROVIDER_TIMEOUT'
  | 'INVALID_LOCATION'
  | 'WEATHER_INVALID_RESPONSE';

const STATUS: Record<WeatherErrorCode, number> = {
  WEATHER_PROVIDER_NOT_CONFIGURED: HttpStatus.SERVICE_UNAVAILABLE,
  WEATHER_PROVIDER_DISABLED: HttpStatus.SERVICE_UNAVAILABLE,
  WEATHER_PROVIDER_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  WEATHER_PROVIDER_AUTH_FAILED: HttpStatus.BAD_GATEWAY,
  WEATHER_PROVIDER_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  WEATHER_PROVIDER_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  INVALID_LOCATION: HttpStatus.BAD_REQUEST,
  WEATHER_INVALID_RESPONSE: HttpStatus.BAD_GATEWAY,
};

const MESSAGE: Record<WeatherErrorCode, string> = {
  WEATHER_PROVIDER_NOT_CONFIGURED: 'Weather is not configured.',
  WEATHER_PROVIDER_DISABLED: 'Weather is turned off.',
  WEATHER_PROVIDER_UNAVAILABLE: 'Weather is unavailable.',
  WEATHER_PROVIDER_AUTH_FAILED: 'Weather provider rejected the server credentials.',
  WEATHER_PROVIDER_RATE_LIMITED: 'Weather is busy. Try again shortly.',
  WEATHER_PROVIDER_TIMEOUT: 'Weather took too long to respond.',
  INVALID_LOCATION: 'Latitude and longitude are not valid.',
  WEATHER_INVALID_RESPONSE: 'Weather returned an unexpected response.',
};

export class WeatherProviderError extends Error {
  constructor(readonly code: WeatherErrorCode) {
    super(MESSAGE[code]);
    this.name = 'WeatherProviderError';
  }
}

export class ArahException extends HttpException {
  constructor(code: string, message: string, status: number) {
    super({ message, code }, status);
  }
}

export function weatherException(code: WeatherErrorCode): ArahException {
  return new ArahException(code, MESSAGE[code], STATUS[code]);
}
