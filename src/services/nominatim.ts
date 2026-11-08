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
const RESULT_LIMIT = 15;

type SearchHit = Place & { city: string; state: string; country: string };
type UserArea = { city: string; state: string; country: string };

const areaCache = new Map<string, { at: number; area: UserArea }>();

export async function searchPlaces(query: string, signal?: AbortSignal, near?: Coordinate): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const origin = near && isValidCoordinate(near.latitude, near.longitude) ? near : undefined;
  const areaKey = origin ? `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)}` : 'any';
  const key = `${areaKey}:${trimmed.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.places;

  const area = origin ? await lookupArea(origin, signal) : null;
  const localText = withoutArea(trimmed, area) || trimmed;
  const focus = focusWord(localText);
  const boundedQuery = focus || localText;
  const local = origin ? await fetchHits(boundedQuery, signal, origin, true, 20) : [];
  if (signal?.aborted) return rankHits(local, trimmed, origin, area);
  const inCity = origin && area?.city && focus ? await fetchHits(`${focus} ${area.city}`, signal, undefined, false, 12) : [];
  if (signal?.aborted) return rankHits([...local, ...inCity], trimmed, origin, area);
  const wider = await fetchHits(origin ? localText : trimmed, signal, undefined, false, 12);
  const places = origin ? rankHits([...local, ...inCity, ...wider], trimmed, origin, area) : asPlaces(wider);
  cache.set(key, { at: Date.now(), places });
  return places;
}

async function fetchHits(
  query: string,
  signal: AbortSignal | undefined,
  near: Coordinate | undefined,
  bounded: boolean,
  limit: number,
): Promise<SearchHit[]> {
  const url = new URL('/search', env.geocodingBaseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('dedupe', bounded ? '0' : '1');
  url.searchParams.set('limit', String(limit));
  if (near && bounded) {
    url.searchParams.set('viewbox', nearbyViewbox(near, LOCAL_SEARCH_RADIUS_M));
    url.searchParams.set('bounded', '1');
  }

  const payload = await schedule(() => requestJson(url.toString(), { headers: headers(), signal }));
  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError('search.badResponse', 'nominatim');
  }
  return parsed.data.flatMap((row) => {
    const place = toHit(row);
    return place ? [place] : [];
  });
}

async function lookupArea(coordinate: Coordinate, signal?: AbortSignal): Promise<UserArea | null> {
  const key = `${coordinate.latitude.toFixed(2)},${coordinate.longitude.toFixed(2)}`;
  const cached = areaCache.get(key);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.area;

  const url = new URL('/reverse', env.geocodingBaseUrl);
  url.searchParams.set('lat', String(coordinate.latitude));
  url.searchParams.set('lon', String(coordinate.longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '10');
  try {
    const payload = await schedule(() => requestJson(url.toString(), { headers: headers(), signal }));
    const parsed = resultSchema.safeParse(payload);
    if (!parsed.success) return null;
    const area = areaFrom(parsed.data.address ?? undefined);
    if (!area.city && !area.state && !area.country) return null;
    areaCache.set(key, { at: Date.now(), area });
    return area;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

function toHit(row: z.infer<typeof resultSchema>): SearchHit | null {
  const place = toPlace(row);
  if (!place) return null;
  return { ...place, ...areaFrom(row.address ?? undefined) };
}

function areaFrom(address: Record<string, string> | undefined): UserArea {
  return {
    city: pickAddress(address, ['city', 'town', 'village', 'municipality']),
    state: pickAddress(address, ['state']),
    country: pickAddress(address, ['country']),
  };
}

function pickAddress(address: Record<string, string> | undefined, keys: string[]): string {
  if (!address) return '';
  for (const key of keys) {
    const value = address[key]?.trim();
    if (value) return value;
  }
  return '';
}

function rankHits(hits: SearchHit[], query: string, near: Coordinate | undefined, area: UserArea | null): Place[] {
  const seen = new Set<string>();
  const unique: SearchHit[] = [];
  for (const hit of hits) {
    const identity = `${hit.name.toLowerCase()}:${hit.latitude.toFixed(4)}:${hit.longitude.toFixed(4)}`;
    if (seen.has(hit.id) || seen.has(identity)) continue;
    seen.add(hit.id);
    seen.add(identity);
    unique.push(hit);
  }
  unique.sort((left, right) => {
    const band = matchBand(query, left, near, area) - matchBand(query, right, near, area);
    if (band !== 0) return band;
    const tier = placeTier(left, near, area) - placeTier(right, near, area);
    if (tier !== 0) return tier;
    const words = wordScore(query, right) - wordScore(query, left);
    if (words !== 0) return words;
    if (!near) return left.name.localeCompare(right.name);
    return distanceMeters(near, left) - distanceMeters(near, right);
  });
  return unique.slice(0, RESULT_LIMIT).map(({ city: _city, state: _state, country: _country, ...place }) => place);
}

function matchBand(query: string, hit: SearchHit, near: Coordinate | undefined, area: UserArea | null): number {
  if (wordScore(query, hit) <= 0) return 2;
  return placeTier(hit, near, area) <= 1 ? 0 : 1;
}

function placeTier(hit: SearchHit, near: Coordinate | undefined, area: UserArea | null): number {
  const distance = near ? distanceMeters(near, hit) : Number.POSITIVE_INFINITY;
  if (sameText(hit.city, area?.city) || addressHas(hit.address, area?.city)) return 0;
  if (distance <= LOCAL_SEARCH_RADIUS_M) return 1;
  if (sameText(hit.state, area?.state) || addressHas(hit.address, area?.state)) return 2;
  if (sameText(hit.country, area?.country) || addressHas(hit.address, area?.country)) return 3;
  return 4;
}

const GENERIC_WORDS = new Set([
  'road',
  'marg',
  'nagar',
  'colony',
  'garden',
  'park',
  'chowk',
  'market',
  'bazaar',
  'bazar',
  'school',
  'hospital',
  'mandir',
  'masjid',
  'temple',
  'ward',
  'sector',
  'phase',
  'block',
  'near',
  'city',
  'area',
  'street',
  'lane',
  'gali',
  'cross',
  'circle',
  'square',
  'stand',
  'auto',
  'gate',
  'गार्डन',
  'नगर',
  'कॉलोनी',
  'रोड',
  'मार्ग',
  'चौक',
  'बाजार',
]);

function queryTokens(query: string): string[] {
  return query
    .split(/[\s,]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

function withoutArea(query: string, area: UserArea | null): string {
  const skip = new Set(
    [area?.city, area?.state, area?.country]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );
  return queryTokens(query)
    .filter((word) => !skip.has(word.toLowerCase()))
    .join(' ');
}

function focusWord(query: string): string {
  const words = queryTokens(query).filter((word) => word.length >= 3 && !GENERIC_WORDS.has(word.toLowerCase()));
  words.sort((left, right) => right.length - left.length);
  return words[0]?.toLowerCase() ?? '';
}

function wordScore(query: string, hit: SearchHit): number {
  const words = queryTokens(query).map((word) => word.toLowerCase());
  const name = hit.name.toLowerCase();
  const address = hit.address.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (wordIn(name, word)) score += 2;
    else if (wordIn(address, word)) score += 1;
  }
  if (name === query.trim().toLowerCase()) score += 4;
  return score;
}

function wordIn(text: string, word: string): boolean {
  if (text.includes(word)) return true;
  if (word.length < 6) return false;
  const stem = word.slice(0, -1);
  return text.split(/[\s,]+/).some((token) => token.startsWith(stem) && Math.abs(token.length - word.length) <= 1);
}

function sameText(left: string | undefined, right: string | undefined): boolean {
  const a = left?.trim().toLowerCase() ?? '';
  const b = right?.trim().toLowerCase() ?? '';
  return a.length > 1 && a === b;
}

function addressHas(address: string, value: string | undefined): boolean {
  const text = value?.trim().toLowerCase() ?? '';
  if (text.length < 2) return false;
  return address.split(',').some((part) => part.trim().toLowerCase() === text);
}

function asPlaces(hits: SearchHit[]): Place[] {
  return hits.slice(0, RESULT_LIMIT).map(({ city: _city, state: _state, country: _country, ...place }) => place);
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
