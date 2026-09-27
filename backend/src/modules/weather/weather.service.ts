import { Inject, Injectable, Optional } from '@nestjs/common';

import { RedisService } from '../../cache/redis.service';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { OpenWeatherProvider } from '../../providers/openweather.provider';
import { weatherBucket, type CurrentWeather } from '../../providers/weather.types';
import { WeatherProviderError, weatherException } from '../../security/weather-errors';
import { ProviderConfigService } from '../provider-config/provider-config.service';

export const WEATHER_WAIT = Symbol('WEATHER_WAIT');

@Injectable()
export class WeatherService {
  constructor(
    private readonly configs: ProviderConfigService,
    private readonly redis: RedisService,
    private readonly openWeather: OpenWeatherProvider,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Optional() @Inject(WEATHER_WAIT) private readonly wait: ((ms: number) => Promise<void>) | null = null,
  ) {}

  async current(latitude: number, longitude: number): Promise<CurrentWeather> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw weatherException('INVALID_LOCATION');
    }
    const cacheKey = `weather:${weatherBucket(latitude)}:${weatherBucket(longitude)}`;
    const cached = await this.readCache(cacheKey);
    if (cached) return cached;
    const lockKey = `weather-lock:${weatherBucket(latitude)}:${weatherBucket(longitude)}`;
    const locked = await this.redis.setIfAbsent(lockKey, '1', 8);
    if (!locked) return this.waitForShared(cacheKey);
    try {
      const resolved = await this.configs.activeWeather();
      if (!resolved) throw weatherException('WEATHER_PROVIDER_NOT_CONFIGURED');
      if (!resolved.enabled) throw weatherException('WEATHER_PROVIDER_DISABLED');
      if (!resolved.apiKey || resolved.provider !== 'openweather') throw weatherException('WEATHER_PROVIDER_NOT_CONFIGURED');
      const weather = await this.openWeather.current({
        latitude,
        longitude,
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        timeoutMs: resolved.timeoutMs,
      });
      await this.redis.set(cacheKey, JSON.stringify(weather), this.config.weatherCacheTtlSeconds);
      return weather;
    } catch (error) {
      if (error instanceof WeatherProviderError) throw weatherException(error.code);
      throw error;
    } finally {
      await this.redis.delete(lockKey);
    }
  }

  private async waitForShared(cacheKey: string): Promise<CurrentWeather> {
    const pause = this.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await pause(150);
      const shared = await this.readCache(cacheKey);
      if (shared) return shared;
    }
    throw weatherException('WEATHER_PROVIDER_UNAVAILABLE');
  }

  private async readCache(key: string): Promise<CurrentWeather | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as CurrentWeather;
      if (parsed?.provider !== 'openweather' || !parsed.weather) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
