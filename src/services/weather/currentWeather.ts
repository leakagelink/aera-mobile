import { aeraApiRequest } from '@/services/api/client';
import { isValidCoordinate } from '@/utils/geo';
import { AppError } from '@/utils/errors';

export type CurrentWeather = {
  location: { latitude: number; longitude: number };
  weather: {
    temperature: number | null;
    feelsLike: number | null;
    humidity: number | null;
    pressure: number | null;
    windSpeed: number | null;
    windDirection: number | null;
    condition: string | null;
    description: string | null;
    visibility: number | null;
    cloudCoverage: number | null;
    precipitation: number | null;
    sunrise: string | null;
    sunset: string | null;
    observedAt: string | null;
  };
  provider: string;
};

export async function fetchCurrentWeather(latitude: number, longitude: number, signal?: AbortSignal): Promise<CurrentWeather> {
  if (!isValidCoordinate(latitude, longitude)) {
    throw new AppError('A valid latitude and longitude are required.', 'invalid');
  }
  const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
  return aeraApiRequest(`/api/v1/weather/current?${params.toString()}`, { method: 'GET', signal }) as Promise<CurrentWeather>;
}
