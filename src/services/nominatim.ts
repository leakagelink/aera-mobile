import { z } from 'zod';

import { env } from '@/services/env';
import { requestJson } from '@/services/http';
import type { Coordinate } from '@/types/location';
import type { Place } from '@/types/place';
import { AppError } from '@/utils/errors';
import { isValidCoordinate } from '@/utils/geo';

const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 60_000;

const resultSchema = z.object({
  place_id: z.union([z.number(), z.string()]),
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  name: z.string().nullish(),
  type: z.string().nullish(),
  address: z.record(z.string(), z.string()).nullish(),
});

const searchSchema = z.array(resultSchema);

type CacheEntry = { at: number; places: Place[] };

const cache = new Map<string, CacheEntry>();
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function headers(): Record<string, string> {
  return {
    'User-Agent': env.nominatimUserAgent,
    Referer: 'https://github.com/leakagelink/aera-mobile',
  };
}

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait > 0) await delay(wait);
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toPlace(row: z.infer<typeof resultSchema>): Place | null {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!isValidCoordinate(latitude, longitude)) return null;
  const name = row.name?.trim() || row.display_name.split(',')[0]?.trim() || 'Place';
  return {
    id: String(row.place_id),
    name,
    address: row.display_name,
    latitude,
    longitude,
    category: row.type ?? undefined,
  };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const key = trimmed.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.places;

  const url = new URL('/search', env.nominatimBaseUrl);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');

  const payload = await schedule(() => requestJson(url.toString(), { headers: headers(), signal }));
  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError('Place search returned an unexpected response.', 'nominatim');
  }

  const places = parsed.data.flatMap((row) => {
    const place = toPlace(row);
    return place ? [place] : [];
  });
  cache.set(key, { at: Date.now(), places });
  return places;
}

export async function reverseGeocode(coordinate: Coordinate, signal?: AbortSignal): Promise<Place | null> {
  if (!isValidCoordinate(coordinate.latitude, coordinate.longitude)) {
    throw new AppError('That location is not valid.', 'invalid');
  }

  const key = `reverse:${coordinate.latitude.toFixed(4)},${coordinate.longitude.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.places[0] ?? null;

  const url = new URL('/reverse', env.nominatimBaseUrl);
  url.searchParams.set('lat', String(coordinate.latitude));
  url.searchParams.set('lon', String(coordinate.longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');

  const payload = await schedule(() => requestJson(url.toString(), { headers: headers(), signal }));
  if (payload && typeof payload === 'object' && 'error' in payload) return null;

  const parsed = resultSchema.safeParse(payload);
  if (!parsed.success) return null;
  const place = toPlace(parsed.data);
  cache.set(key, { at: Date.now(), places: place ? [place] : [] });
  return place;
}
