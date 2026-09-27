import { recentPlacesSchema } from '@/data/schemas';
import { readStored, writeStored } from '@/data/storage';
import type { Place } from '@/types/place';

const RECENT_KEY = 'aera.recent-places.v1';
const LIMIT = 8;

export async function readRecentPlaces(): Promise<Place[]> {
  return readStored(RECENT_KEY, recentPlacesSchema, []);
}

export async function rememberPlace(place: Place): Promise<Place[]> {
  const existing = await readRecentPlaces();
  const next = [place, ...existing.filter((item) => item.id !== place.id)].slice(0, LIMIT);
  await writeStored(RECENT_KEY, next);
  return next;
}
