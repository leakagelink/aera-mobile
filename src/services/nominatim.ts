import { z } from 'zod';

import { env } from '@/services/env';
import { requestJson } from '@/services/http';
import type { Coordinate } from '@/types/location';
import type { Place } from '@/types/place';
import { AppError } from '@/utils/errors';
import { distanceMeters, isValidCoordinate } from '@/utils/geo';

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
    'User-Agent': env.geocodingUserAgent,
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

const LOCAL_SEARCH_RADIUS_M = 50_000;

export async function searchPlaces(query: string, signal?: AbortSignal, near?: Coordinate): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const origin = near && isValidCoordinate(near.latitude, near.longitude) ? near : undefined;
  const area = origin ? `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)}` : 'any';
  const key = `${area}:${trimmed.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.places;

  const local = origin ? await fetchSearch(trimmed, signal, origin, true) : [];
  if (signal?.aborted) return local;
  const wider = await fetchSearch(trimmed, signal, origin, false);
  const places = origin ? rankByNearness(local, wider, origin) : wider;
  cache.set(key, { at: Date.now(), places });
  return places;
}

async function fetchSearch(query: string, signal: AbortSignal | undefined, near: Coordinate | undefined, bounded: boolean): Promise<Place[]> {
  const url = new URL('/search', env.geocodingBaseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', bounded ? '6' : '8');
  if (near) {
    url.searchParams.set('viewbox', nearbyViewbox(near, LOCAL_SEARCH_RADIUS_M));
    if (bounded) url.searchParams.set('bounded', '1');
  }

  const payload = await schedule(() => requestJson(url.toString(), { headers: headers(), signal }));
  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError('Place search returned an unexpected response.', 'nominatim');
  }
  return parsed.data.flatMap((row) => {
    const place = toPlace(row);
    return place ? [place] : [];
  });
}

function rankByNearness(local: Place[], wider: Place[], near: Coordinate): Place[] {
  const seen = new Set<string>();
  const unique: Place[] = [];
  for (const place of [...local, ...wider]) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    unique.push(place);
  }
  const nearby: Place[] = [];
  const rest: Place[] = [];
  for (const place of unique) {
    if (distanceMeters(near, place) <= LOCAL_SEARCH_RADIUS_M) nearby.push(place);
    else rest.push(place);
  }
  const byDistance = (left: Place, right: Place) => distanceMeters(near, left) - distanceMeters(near, right);
  return [...nearby.sort(byDistance), ...rest.sort(byDistance)].slice(0, 8);
}

export async function reverseGeocode(coordinate: Coordinate, signal?: AbortSignal): Promise<Place | null> {
  if (!isValidCoordinate(coordinate.latitude, coordinate.longitude)) {
    throw new AppError('That location is not valid.', 'invalid');
  }

  const key = `reverse:${coordinate.latitude.toFixed(4)},${coordinate.longitude.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.places[0] ?? null;

  const url = new URL('/reverse', env.geocodingBaseUrl);
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

const NEARBY_RADIUS_M = 1_200;
const NEARBY_MOVE_M = 400;
const NEARBY_CACHE_TTL_MS = 5 * 60 * 1000;
const NEARBY_CATEGORIES = ['restaurant', 'cafe', 'park', 'hospital'] as const;

let lastNearby: { at: number; ttl: number; coordinate: Coordinate; places: Place[] } | null = null;

export async function nearbyPlaces(coordinate: Coordinate, signal?: AbortSignal): Promise<Place[]> {
  if (!isValidCoordinate(coordinate.latitude, coordinate.longitude)) return [];
  if (
    lastNearby &&
    Date.now() - lastNearby.at < lastNearby.ttl &&
    distanceMeters(lastNearby.coordinate, coordinate) < NEARBY_MOVE_M
  ) {
    return lastNearby.places;
  }

  const seen = new Set<string>();
  const collected: Place[] = [];
  for (const category of NEARBY_CATEGORIES) {
    if (signal?.aborted) return collected;
    const batch = await searchNearbyCategory(category, coordinate, signal, NEARBY_RADIUS_M, 3);
    for (const place of batch) {
      const distance = distanceMeters(coordinate, place);
      if (distance < 30 || distance > NEARBY_RADIUS_M) continue;
      const identity = `${place.name.toLowerCase()}:${place.latitude.toFixed(4)}:${place.longitude.toFixed(4)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      collected.push(place);
    }
  }
  if (signal?.aborted) return collected;

  const places = collected.sort((a, b) => distanceMeters(coordinate, a) - distanceMeters(coordinate, b)).slice(0, 8);
  lastNearby = { at: Date.now(), ttl: places.length > 0 ? NEARBY_CACHE_TTL_MS : CACHE_TTL_MS, coordinate, places };
  return places;
}

const categoryCache = new Map<string, { at: number; ttl: number; places: Place[] }>();

export async function nearbyCategoryPlaces(
  coordinate: Coordinate,
  category: string,
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<Place[]> {
  if (!isValidCoordinate(coordinate.latitude, coordinate.longitude)) return [];
  const key = `${category}:${radiusMeters}:${coordinate.latitude.toFixed(3)},${coordinate.longitude.toFixed(3)}`;
  const cached = categoryCache.get(key);
  if (cached && Date.now() - cached.at < cached.ttl) return cached.places;

  const batch = await searchNearbyCategory(category, coordinate, signal, radiusMeters, 8);
  if (signal?.aborted) return [];
  const places = batch
    .filter((place) => distanceMeters(coordinate, place) <= radiusMeters && matchesCategory(category, place))
    .sort((a, b) => distanceMeters(coordinate, a) - distanceMeters(coordinate, b))
    .slice(0, 8);
  categoryCache.set(key, { at: Date.now(), ttl: places.length > 0 ? NEARBY_CACHE_TTL_MS : CACHE_TTL_MS, places });
  return places;
}

function matchesCategory(category: string, place: Place): boolean {
  if (category === 'airport') return place.category === 'aerodrome' || place.category === 'airport' || /airport/i.test(place.name);
  if (category === '[railway=station]') return place.category === 'station';
  return true;
}

async function searchNearbyCategory(
  category: string,
  coordinate: Coordinate,
  signal: AbortSignal | undefined,
  radiusMeters: number,
  limit: number,
): Promise<Place[]> {
  const url = new URL('/search', env.geocodingBaseUrl);
  url.searchParams.set('q', category);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('viewbox', nearbyViewbox(coordinate, radiusMeters));
  url.searchParams.set('bounded', '1');

  try {
    const payload = await schedule(() => requestJson(url.toString(), { headers: headers(), signal }));
    const parsed = searchSchema.safeParse(payload);
    if (!parsed.success) return [];
    return parsed.data.flatMap((row) => {
      const place = toPlace(row);
      return place && place.name.length > 1 ? [place] : [];
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return [];
  }
}

function nearbyViewbox(coordinate: Coordinate, radiusMeters: number): string {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta = radiusMeters / (111_320 * Math.max(0.2, Math.cos((coordinate.latitude * Math.PI) / 180)));
  const left = coordinate.longitude - longitudeDelta;
  const right = coordinate.longitude + longitudeDelta;
  const top = coordinate.latitude + latitudeDelta;
  const bottom = coordinate.latitude - latitudeDelta;
  return `${left},${top},${right},${bottom}`;
}
