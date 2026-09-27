import { normalizeOpenWeather, type CurrentWeather } from './weather.types';
import { WeatherProviderError } from '../security/weather-errors';
import type { WeatherProvider, WeatherRequest } from './weather-provider';

export type WeatherFetch = (url: string, timeoutMs: number) => Promise<{ status: number; body: unknown }>;

export class OpenWeatherProvider implements WeatherProvider {
  readonly id = 'openweather' as const;

  constructor(private readonly fetchWeather: WeatherFetch = defaultWeatherFetch) {}

  async current(input: WeatherRequest): Promise<CurrentWeather> {
    if (!input.apiKey.trim()) throw new WeatherProviderError('WEATHER_PROVIDER_NOT_CONFIGURED');
    const url = new URL('/data/2.5/weather', ensureSlash(input.baseUrl));
    url.searchParams.set('lat', String(input.latitude));
    url.searchParams.set('lon', String(input.longitude));
    url.searchParams.set('units', 'metric');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('appid', input.apiKey.trim());
    let response: { status: number; body: unknown };
    try {
      response = await this.fetchWeather(url.toString(), input.timeoutMs);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') throw new WeatherProviderError('WEATHER_PROVIDER_TIMEOUT');
      throw new WeatherProviderError('WEATHER_PROVIDER_UNAVAILABLE');
    }
    if (response.status === 401 || response.status === 403) throw new WeatherProviderError('WEATHER_PROVIDER_AUTH_FAILED');
    if (response.status === 429) throw new WeatherProviderError('WEATHER_PROVIDER_RATE_LIMITED');
    if (response.status < 200 || response.status >= 300) throw new WeatherProviderError('WEATHER_PROVIDER_UNAVAILABLE');
    const weather = normalizeOpenWeather(response.body, input);
    if (weather.weather.temperature === null && weather.weather.condition === null) {
      throw new WeatherProviderError('WEATHER_INVALID_RESPONSE');
    }
    return weather;
  }
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

async function defaultWeatherFetch(url: string, timeoutMs: number): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  const text = await response.text();
  if (!text) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: null };
  }
}
