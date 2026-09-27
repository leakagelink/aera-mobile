import { OpenWeatherProvider } from './openweather.provider';
import { WeatherProviderError } from '../security/weather-errors';

const request = {
  latitude: 22.7196,
  longitude: 75.8577,
  baseUrl: 'https://api.openweathermap.org',
  apiKey: 'test-key-1234',
  timeoutMs: 1000,
};

describe('OpenWeatherProvider', () => {
  it('does not put the API key in a failed response', async () => {
    const provider = new OpenWeatherProvider(async () => ({ status: 401, body: { message: 'Invalid API key' } }));
    await expect(provider.current(request)).rejects.toEqual(expect.any(WeatherProviderError));
    await expect(provider.current(request)).rejects.toMatchObject({ code: 'WEATHER_PROVIDER_AUTH_FAILED', message: 'Weather provider rejected the server credentials.' });
  });

  it('maps timeouts and bad payloads', async () => {
    const timeout = new OpenWeatherProvider(async () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    });
    await expect(timeout.current(request)).rejects.toMatchObject({ code: 'WEATHER_PROVIDER_TIMEOUT' });
    const invalid = new OpenWeatherProvider(async () => ({ status: 200, body: {} }));
    await expect(invalid.current(request)).rejects.toMatchObject({ code: 'WEATHER_INVALID_RESPONSE' });
    const down = new OpenWeatherProvider(async () => ({ status: 503, body: null }));
    await expect(down.current(request)).rejects.toMatchObject({ code: 'WEATHER_PROVIDER_UNAVAILABLE' });
  });

  it('sends the key only on the outbound request', async () => {
    let sawKey = false;
    const provider = new OpenWeatherProvider(async (url) => {
      sawKey = url.includes('appid=test-key-1234');
      return { status: 200, body: { main: { temp: 20 }, weather: [{ main: 'Clear', description: 'clear sky' }] } };
    });
    const weather = await provider.current(request);
    expect(sawKey).toBe(true);
    expect(weather.weather.temperature).toBe(20);
    expect(JSON.stringify(weather)).not.toContain('test-key-1234');
  });
});
