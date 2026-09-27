import { normalizeOpenWeather, weatherBucket } from './weather.types';

describe('normalizeOpenWeather', () => {
  it('maps a provider payload into the Arah weather model', () => {
    const weather = normalizeOpenWeather(
      {
        coord: { lat: 22.72, lon: 75.86 },
        main: { temp: 31.2, feels_like: 33, humidity: 40, pressure: 1008 },
        wind: { speed: 3.1, deg: 180 },
        weather: [{ main: 'Clouds', description: 'scattered clouds' }],
        visibility: 10000,
        clouds: { all: 40 },
        rain: { '1h': 0.2 },
        sys: { sunrise: 1_700_000_000, sunset: 1_700_040_000 },
        dt: 1_700_020_000,
      },
      { latitude: 0, longitude: 0 },
    );
    expect(weather.provider).toBe('openweather');
    expect(weather.location).toEqual({ latitude: 22.72, longitude: 75.86 });
    expect(weather.weather.temperature).toBe(31.2);
    expect(weather.weather.condition).toBe('Clouds');
    expect(weather.weather.precipitation).toBe(0.2);
    expect(weather.weather.observedAt).toBe(new Date(1_700_020_000 * 1000).toISOString());
    expect(JSON.stringify(weather)).not.toContain('appid');
  });

  it('buckets nearby coordinates onto one cache key', () => {
    expect(weatherBucket(22.7196)).toBe('22.72');
    expect(weatherBucket(75.8577)).toBe('75.86');
  });
});
