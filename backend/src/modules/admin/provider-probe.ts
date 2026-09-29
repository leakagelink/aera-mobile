import type { AppConfig } from '../../config/load-config';
import { OpenWeatherProvider } from '../../providers/openweather.provider';
import { TomTomTrafficProvider } from '../../providers/tomtom-traffic.provider';
import type { ProviderSlug } from '../../providers/catalog';
import { WeatherProviderError } from '../../security/weather-errors';

export type ProbeResult = {
  success: boolean;
  latencyMs: number;
  message: string;
};

const TEST_LATITUDE = 22.7196;
const TEST_LONGITUDE = 75.8577;

export async function probeProvider(provider: ProviderSlug, target: { baseUrl: string; apiKey: string | null; timeoutMs: number }, config: Pick<AppConfig, 'geocodingUserAgent'>): Promise<ProbeResult> {
  const started = Date.now();
  try {
    if (provider === 'openweather') {
      if (!target.apiKey) return done(started, false, 'OpenWeather is not configured');
      await new OpenWeatherProvider().current({
        latitude: TEST_LATITUDE,
        longitude: TEST_LONGITUDE,
        baseUrl: target.baseUrl,
        apiKey: target.apiKey,
        timeoutMs: target.timeoutMs,
      });
      return done(started, true, 'OpenWeather connection successful');
    }
    if (provider === 'tomtom') return probeTomTom(target, started);
    if (provider === 'gemini') return probeGemini(target, started);
    if (provider === 'relay') return probeRelay(target, started);
    if (provider === 'osrm') return probeOsrm(target, started);
    if (provider === 'nominatim') return probeNominatim(target, config.geocodingUserAgent, started);
    return probeMartin(target, started);
  } catch (error) {
    if (error instanceof WeatherProviderError && error.code === 'WEATHER_PROVIDER_AUTH_FAILED') {
      return done(started, false, 'OpenWeather connection failed');
    }
    return done(started, false, failureMessage(provider));
  }
}

async function probeTomTom(target: { baseUrl: string; apiKey: string | null; timeoutMs: number }, started: number): Promise<ProbeResult> {
  if (!target.apiKey) return done(started, false, 'TomTom is not configured');
  const report = await new TomTomTrafficProvider().report({
    latitude: TEST_LATITUDE,
    longitude: TEST_LONGITUDE,
    baseUrl: target.baseUrl,
    apiKey: target.apiKey,
    timeoutMs: target.timeoutMs,
  });
  return done(started, report.available, report.available ? 'TomTom connection successful' : 'TomTom connection failed');
}

async function probeGemini(target: { baseUrl: string; apiKey: string | null; timeoutMs: number }, started: number): Promise<ProbeResult> {
  if (!target.apiKey) return done(started, false, 'Gemini is not configured');
  const url = new URL('/v1beta/models', ensureSlash(target.baseUrl));
  url.searchParams.set('key', target.apiKey);
  const status = await statusOnly(url.toString(), target.timeoutMs);
  return done(started, status >= 200 && status < 300, status >= 200 && status < 300 ? 'Gemini connection successful' : 'Gemini connection failed');
}

async function probeRelay(target: { baseUrl: string; apiKey: string | null; timeoutMs: number }, started: number): Promise<ProbeResult> {
  if (!target.apiKey) return done(started, false, 'Relay Models is not configured');
  const url = new URL('models', ensureSlash(target.baseUrl));
  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(target.timeoutMs),
    headers: { Accept: 'application/json', Authorization: `Bearer ${target.apiKey}` },
  });
  await response.arrayBuffer().catch(() => undefined);
  return done(started, response.ok, response.ok ? 'Relay Models connection successful' : 'Relay Models connection failed');
}

async function probeOsrm(target: { baseUrl: string; timeoutMs: number }, started: number): Promise<ProbeResult> {
  const url = new URL(`/nearest/v1/driving/${TEST_LONGITUDE},${TEST_LATITUDE}`, ensureSlash(target.baseUrl));
  const status = await statusOnly(url.toString(), target.timeoutMs);
  return done(started, status >= 200 && status < 300, status >= 200 && status < 300 ? 'OSRM connection successful' : 'OSRM connection failed');
}

async function probeNominatim(target: { baseUrl: string; timeoutMs: number }, userAgent: string, started: number): Promise<ProbeResult> {
  const url = new URL('/search', ensureSlash(target.baseUrl));
  url.searchParams.set('q', 'Indore');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(target.timeoutMs),
    headers: { Accept: 'application/json', 'User-Agent': userAgent, Referer: 'https://github.com/leakagelink/aera-mobile' },
  });
  return done(started, response.ok, response.ok ? 'Nominatim connection successful' : 'Nominatim connection failed');
}

async function probeMartin(target: { baseUrl: string; timeoutMs: number }, started: number): Promise<ProbeResult> {
  if (!target.baseUrl) return done(started, false, 'Map tiles are not configured');
  const status = await statusOnly(target.baseUrl, target.timeoutMs);
  return done(started, status >= 200 && status < 400, status >= 200 && status < 400 ? 'Map tile connection successful' : 'Map tile connection failed');
}

async function statusOnly(url: string, timeoutMs: number): Promise<number> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
  await response.arrayBuffer().catch(() => undefined);
  return response.status;
}

function done(started: number, success: boolean, message: string): ProbeResult {
  return { success, latencyMs: Date.now() - started, message };
}

function failureMessage(provider: ProviderSlug): string {
  const labels: Record<ProviderSlug, string> = {
    openweather: 'OpenWeather connection failed',
    tomtom: 'TomTom connection failed',
    gemini: 'Gemini connection failed',
    relay: 'Relay Models connection failed',
    osrm: 'OSRM connection failed',
    nominatim: 'Nominatim connection failed',
    martin: 'Map tile connection failed',
  };
  return labels[provider];
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
