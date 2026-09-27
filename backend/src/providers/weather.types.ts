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
  provider: 'openweather';
};

type OpenWeatherPayload = {
  cod?: number | string;
  main?: { temp?: number; feels_like?: number; humidity?: number; pressure?: number };
  wind?: { speed?: number; deg?: number };
  weather?: { main?: string; description?: string }[];
  visibility?: number;
  clouds?: { all?: number };
  rain?: { '1h'?: number };
  snow?: { '1h'?: number };
  sys?: { sunrise?: number; sunset?: number };
  dt?: number;
  coord?: { lat?: number; lon?: number };
};

export function normalizeOpenWeather(payload: unknown, fallback: { latitude: number; longitude: number }): CurrentWeather {
  const body = asPayload(payload);
  const condition = body.weather?.[0];
  return {
    location: {
      latitude: numberOr(body.coord?.lat, fallback.latitude),
      longitude: numberOr(body.coord?.lon, fallback.longitude),
    },
    weather: {
      temperature: finiteOrNull(body.main?.temp),
      feelsLike: finiteOrNull(body.main?.feels_like),
      humidity: finiteOrNull(body.main?.humidity),
      pressure: finiteOrNull(body.main?.pressure),
      windSpeed: finiteOrNull(body.wind?.speed),
      windDirection: finiteOrNull(body.wind?.deg),
      condition: textOrNull(condition?.main),
      description: textOrNull(condition?.description),
      visibility: finiteOrNull(body.visibility),
      cloudCoverage: finiteOrNull(body.clouds?.all),
      precipitation: finiteOrNull(body.rain?.['1h'] ?? body.snow?.['1h']),
      sunrise: unixOrNull(body.sys?.sunrise),
      sunset: unixOrNull(body.sys?.sunset),
      observedAt: unixOrNull(body.dt),
    },
    provider: 'openweather',
  };
}

export function weatherBucket(value: number): string {
  return value.toFixed(2);
}

function asPayload(value: unknown): OpenWeatherPayload {
  if (!value || typeof value !== 'object') return {};
  return value as OpenWeatherPayload;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function unixOrNull(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}
