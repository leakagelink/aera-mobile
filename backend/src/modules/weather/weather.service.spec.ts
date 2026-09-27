import { HttpException } from '@nestjs/common';

import type { AppConfig } from '../../config/load-config';
import type { CurrentWeather } from '../../providers/weather.types';
import { WeatherService } from './weather.service';

const weather: CurrentWeather = {
  location: { latitude: 22.72, longitude: 75.86 },
  weather: {
    temperature: 30,
    feelsLike: 31,
    humidity: 40,
    pressure: 1000,
    windSpeed: 2,
    windDirection: 10,
    condition: 'Clear',
    description: 'clear sky',
    visibility: 10000,
    cloudCoverage: 0,
    precipitation: null,
    sunrise: null,
    sunset: null,
    observedAt: null,
  },
  provider: 'openweather',
};

const config = { weatherCacheTtlSeconds: 600 } as AppConfig;

function harness(options?: { cached?: string | null; lock?: boolean; resolved?: unknown }) {
  const redis = {
    get: jest.fn(async () => options?.cached ?? null),
    set: jest.fn(async () => undefined),
    setIfAbsent: jest.fn(async () => options?.lock ?? true),
    delete: jest.fn(async () => undefined),
  };
  const openWeather = { id: 'openweather' as const, current: jest.fn(async () => weather) };
  const resolved = options && 'resolved' in options ? options.resolved : { provider: 'openweather', enabled: true, apiKey: 'test-key-1234', baseUrl: 'https://api.openweathermap.org', timeoutMs: 1000 };
  const configs = { activeWeather: jest.fn(async () => resolved) };
  const service = new WeatherService(configs as never, redis as never, openWeather as never, config, async () => undefined);
  return { service, redis, openWeather };
}

describe('WeatherService', () => {
  it('returns a cache hit without calling OpenWeather', async () => {
    const { service, openWeather } = harness({ cached: JSON.stringify(weather) });
    await expect(service.current(22.7196, 75.8577)).resolves.toMatchObject({ provider: 'openweather' });
    expect(openWeather.current).not.toHaveBeenCalled();
  });

  it('stores a cache miss for the configured TTL', async () => {
    const { service, redis, openWeather } = harness();
    await service.current(22.7196, 75.8577);
    expect(openWeather.current).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('weather:22.72:75.86', JSON.stringify(weather), 600);
  });

  it('waits for an in-flight request instead of calling the provider twice', async () => {
    const redis = {
      get: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(weather)),
      set: jest.fn(),
      setIfAbsent: jest.fn(async () => false),
      delete: jest.fn(),
    };
    const openWeather = { id: 'openweather' as const, current: jest.fn(async () => weather) };
    const configs = { activeWeather: jest.fn() };
    const service = new WeatherService(configs as never, redis as never, openWeather as never, config, async () => undefined);
    await expect(service.current(22.72, 75.86)).resolves.toMatchObject({ weather: { temperature: 30 } });
    expect(openWeather.current).not.toHaveBeenCalled();
    expect(redis.delete).not.toHaveBeenCalled();
  });

  it('reports a missing provider and a disabled provider', async () => {
    const missing = harness({ resolved: null });
    await expect(missing.service.current(22.72, 75.86)).rejects.toBeInstanceOf(HttpException);
    const disabled = harness({ resolved: { provider: 'openweather', enabled: false, apiKey: null, baseUrl: 'https://api.openweathermap.org', timeoutMs: 1000 } });
    try {
      await disabled.service.current(22.72, 75.86);
      throw new Error('expected a disabled provider error');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'WEATHER_PROVIDER_DISABLED' });
    }
  });

  it('rejects coordinates outside the valid range', async () => {
    const { service, openWeather } = harness();
    await expect(service.current(999, 75)).rejects.toMatchObject({ message: 'Latitude and longitude are not valid.' });
    expect(openWeather.current).not.toHaveBeenCalled();
  });
});
