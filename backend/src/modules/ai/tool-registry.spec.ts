import { ArahException } from '../../security/weather-errors';
import { ArahToolRegistry } from './tool-registry';

const userId = '00000000-0000-4000-8000-000000000001';
const location = { latitude: 22.72, longitude: 75.86, accuracy: 5, heading: 90, speed: 12, timestamp: '2026-09-27T12:00:00.000Z' };
const route = {
  label: 'A',
  summary: 'Airport Road',
  distanceMeters: 1000,
  durationSeconds: 120,
  geometry: [
    { latitude: 22.72, longitude: 75.86 },
    { latitude: 22.73, longitude: 75.87 },
  ],
};

function registry(overrides: Partial<{ places: unknown; routes: unknown; trips: unknown; weather: unknown; traffic: unknown }> = {}) {
  return new ArahToolRegistry(
    (overrides.places ?? { search: jest.fn(async () => [{ id: '1', name: 'Airport', address: 'Airport Road', latitude: 22.73, longitude: 75.87 }]) }) as never,
    (overrides.routes ?? { preview: jest.fn(async () => [route, { ...route, summary: 'Longer', distanceMeters: 1400, durationSeconds: 180 }]) }) as never,
    (overrides.trips ?? {
      list: jest.fn(async () => [
        {
          id: 'trip-1',
          startedAt: '2026-09-27T10:00:00.000Z',
          endedAt: '2026-09-27T10:10:00.000Z',
          durationSeconds: 600,
          distanceMeters: 5000,
          movingSeconds: 500,
          stoppedSeconds: 100,
          averageSpeedMps: 10,
          maxSpeedMps: 15,
          originName: 'Home',
          destinationName: 'Airport',
          status: 'completed',
        },
      ]),
    }) as never,
    (overrides.weather ?? { current: jest.fn(async () => ({ location, weather: { temperature: 30, condition: 'Clear' }, provider: 'openweather' })) }) as never,
    (overrides.traffic ?? { report: jest.fn(async () => ({ available: true, flow: { currentSpeedMps: 9 }, incidents: [] })) }) as never,
  );
}

describe('ArahToolRegistry', () => {
  it('reads location and speed only from the device context', async () => {
    const tools = registry();
    await expect(tools.execute('getCurrentLocation', {}, { userId })).resolves.toMatchObject({ result: { code: 'LOCATION_UNAVAILABLE' } });
    await expect(tools.execute('getCurrentLocation', { latitude: 1, longitude: 2 }, { userId, location })).resolves.toMatchObject({ result: { code: 'AI_TOOL_INVALID_ARGUMENTS' } });
    await expect(tools.execute('getCurrentLocation', {}, { userId, location })).resolves.toMatchObject({ result: { latitude: 22.72, speed: 12 } });
    await expect(tools.execute('getCurrentSpeed', {}, { userId })).resolves.toMatchObject({ result: { code: 'SPEED_UNAVAILABLE' } });
    await expect(tools.execute('getCurrentSpeed', {}, { userId, location })).resolves.toMatchObject({ result: { speed: 12, unit: 'm/s' } });
  });

  it('searches places and previews routes without sending the full geometry', async () => {
    const routes = { preview: jest.fn(async () => [route, { ...route, summary: 'Longer', distanceMeters: 1400, durationSeconds: 180 }]) };
    const tools = registry({ routes });
    const place = await tools.execute('searchPlace', { query: 'airport' }, { userId });
    expect(place.result).toEqual([{ name: 'Airport', latitude: 22.73, longitude: 75.87, address: 'Airport Road' }]);
    const calculated = await tools.execute('calculateRoute', { destinationLatitude: 22.73, destinationLongitude: 75.87, avoidTolls: true }, { userId, location });
    expect(calculated.result).toMatchObject({ distanceMeters: 1000, durationSeconds: 120, geometryPointCount: 2, steps: [], constraints: { avoidTolls: 'not_supported' } });
    expect(calculated.result).not.toHaveProperty('geometry');
    const alternatives = await tools.execute('getAlternativeRoutes', { destinationLatitude: 22.73, destinationLongitude: 75.87 }, { userId, location });
    expect(alternatives.result).toMatchObject({ routes: [expect.anything(), expect.objectContaining({ differenceFromPrimary: { distanceMeters: 400, durationSeconds: 60, index: 1 } })] });
    expect(routes.preview).toHaveBeenCalled();
  });

  it('uses navigation state for ETA and refuses an invented one', async () => {
    const tools = registry();
    await expect(tools.execute('getETA', {}, { userId })).resolves.toMatchObject({ result: { code: 'ROUTE_UNAVAILABLE' } });
    const eta = await tools.execute('getETA', {}, { userId, navigation: { remainingMeters: 400, remainingSeconds: 40, eta: Date.parse('2026-09-27T12:10:00.000Z') } });
    expect(eta.result).toMatchObject({ source: 'navigation', remainingDistanceMeters: 400, remainingDurationSeconds: 40 });
  });

  it('reads only the authenticated user trips and does not expose road history', async () => {
    const trips = { list: jest.fn(async () => []) };
    const tools = registry({ trips });
    await expect(tools.execute('getTripHistory', { userId: '00000000-0000-4000-8000-000000000099' }, { userId })).resolves.toMatchObject({ result: { code: 'AI_TOOL_INVALID_ARGUMENTS' } });
    await expect(tools.execute('getTripStats', {}, { userId })).resolves.toMatchObject({ result: { code: 'TRIP_UNAVAILABLE' } });
    expect(trips.list).toHaveBeenCalledWith(userId, 20);
    const populated = registry();
    const history = await populated.execute('getTripHistory', { limit: 5 }, { userId });
    expect(history.result).toMatchObject({ count: 1, totalDistanceMeters: 5000, lastTrip: { destinationName: 'Airport' } });
    expect(JSON.stringify(history.result)).not.toContain('latitude');
    await expect(tools.execute('getRoadHistory', {}, { userId })).resolves.toMatchObject({ result: { code: 'ROAD_HISTORY_NOT_AVAILABLE' } });
  });

  it('returns provider codes for weather and traffic instead of invented conditions', async () => {
    const weatherDown = registry({ weather: { current: jest.fn(async () => { throw new ArahException('WEATHER_PROVIDER_NOT_CONFIGURED', 'Weather is not configured.', 503); }) } });
    await expect(weatherDown.execute('getWeather', {}, { userId, location })).resolves.toMatchObject({ result: { code: 'WEATHER_PROVIDER_NOT_CONFIGURED' } });
    const weather = registry();
    const current = await weather.execute('getWeather', {}, { userId, location });
    expect(current.result).toMatchObject({ weather: { temperature: 30 } });
    expect(JSON.stringify(current.result)).not.toContain('openweather');
    const trafficDown = registry({ traffic: { report: jest.fn(async () => ({ available: false, reason: 'not_configured', flow: null, incidents: [] })) } });
    await expect(trafficDown.execute('getTraffic', {}, { userId, location })).resolves.toMatchObject({ result: { code: 'TRAFFIC_PROVIDER_NOT_CONFIGURED' } });
    await expect(registry().execute('getTraffic', {}, { userId })).resolves.toMatchObject({ result: { code: 'LOCATION_UNAVAILABLE' } });
    await expect(registry().execute('dropTable', {}, { userId })).resolves.toMatchObject({ result: { code: 'AI_TOOL_NOT_FOUND' } });
  });
});
