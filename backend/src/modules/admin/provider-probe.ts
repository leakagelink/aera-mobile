import type { AppConfig } from '../../config/load-config';
import { elevenLabsOrigin } from '../../providers/elevenlabs.provider';
import { OpenWeatherProvider } from '../../providers/openweather.provider';
import { TomTomTrafficProvider } from '../../providers/tomtom-traffic.provider';
import type { ProviderSlug } from '../../providers/catalog';
import { WeatherProviderError } from '../../security/weather-errors';

export type ProbeResult = {
  success: boolean;
  latencyMs: number;
  message: string;
  baseUrl?: string;
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
    if (provider === 'elevenlabs') return probeElevenLabs(target, started);
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
  if (report.available) return done(started, true, 'TomTom connection successful');
  const message = report.reason === 'auth_failed' ? 'TomTom rejected the API key. Turn on Traffic Flow for this key.' : 'TomTom connection failed';
  return done(started, false, message);
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

const ELEVENLABS_HOSTS = [
  'https://api.elevenlabs.io',
  'https://api.us.elevenlabs.io',
  'https://api.eu.residency.elevenlabs.io',
  'https://api.in.residency.elevenlabs.io',
  'https://api.sg.residency.elevenlabs.io',
];

async function probeElevenLabs(target: { baseUrl: string; apiKey: string | null; timeoutMs: number }, started: number): Promise<ProbeResult> {
  if (!target.apiKey) return done(started, false, 'ElevenLabs is not configured');
  const origin = elevenLabsOrigin(target.baseUrl);
  const first = await elevenGet(new URL('v1/models', origin).toString(), target.apiKey, target.timeoutMs);
  if (first.ok) return done(started, true, 'ElevenLabs connection successful', origin);
  if (!first.ok && !first.residency) {
    const voices = await elevenGet(new URL('v1/voices', origin).toString(), target.apiKey, target.timeoutMs);
    if (voices.ok) return done(started, true, 'ElevenLabs connection successful', origin);
  }
  if (first.residency) {
    for (const host of ELEVENLABS_HOSTS) {
      const next = elevenLabsOrigin(host);
      if (next === origin) continue;
      const attempt = await elevenGet(new URL('v1/models', next).toString(), target.apiKey, target.timeoutMs);
      if (attempt.ok) return done(started, true, 'ElevenLabs connection successful', next);
    }
  }
  return done(started, false, 'ElevenLabs connection failed');
}

async function elevenGet(url: string, apiKey: string, timeoutMs: number): Promise<{ ok: boolean; residency: boolean }> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'xi-api-key': apiKey },
  });
  const text = await response.text().catch(() => '');
  return { ok: response.ok, residency: /data residency/i.test(text) };
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

function done(started: number, success: boolean, message: string, baseUrl?: string): ProbeResult {
  return { success, latencyMs: Date.now() - started, message, ...(baseUrl ? { baseUrl: baseUrl.replace(/\/$/, '') } : {}) };
}

function failureMessage(provider: ProviderSlug): string {
  const labels: Record<ProviderSlug, string> = {
    openweather: 'OpenWeather connection failed',
    tomtom: 'TomTom connection failed',
    gemini: 'Gemini connection failed',
    relay: 'Relay Models connection failed',
    elevenlabs: 'ElevenLabs connection failed',
    osrm: 'OSRM connection failed',
    nominatim: 'Nominatim connection failed',
    martin: 'Map tile connection failed',
  };
  return labels[provider];
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
