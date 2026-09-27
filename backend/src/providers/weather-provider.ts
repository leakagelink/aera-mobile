import type { CurrentWeather } from './weather.types';

export interface WeatherProvider {
  readonly id: 'openweather';
  current(input: WeatherRequest): Promise<CurrentWeather>;
}

export type WeatherRequest = {
  latitude: number;
  longitude: number;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
};
