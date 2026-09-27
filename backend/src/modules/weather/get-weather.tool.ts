import type { CurrentWeather } from '../../providers/weather.types';
import { WeatherService } from './weather.service';

export type GetWeatherInput = {
  latitude: number;
  longitude: number;
};

export async function getWeather(weather: WeatherService, input: GetWeatherInput): Promise<CurrentWeather> {
  return weather.current(input.latitude, input.longitude);
}
