import { tripDraftSchema, tripListSchema } from '@/data/schemas';
import { readStored, removeStored, writeStored } from '@/data/storage';
import type { Trip, TripDraft } from '@/types/trip';

const TRIPS_KEY = 'aera.trips.v1';
const DRAFT_KEY = 'aera.trip-draft.v1';

export interface TripRepository {
  list(): Promise<Trip[]>;
  save(trip: Trip): Promise<Trip[]>;
  removeAll(): Promise<void>;
  readDraft(): Promise<TripDraft | null>;
  saveDraft(draft: TripDraft): Promise<void>;
  clearDraft(): Promise<void>;
}

export const localTripRepository: TripRepository = {
  async list() {
    const trips = await readStored(TRIPS_KEY, tripListSchema, []);
    return trips.sort((a, b) => b.startedAt - a.startedAt);
  },
  async save(trip) {
    const existing = await readStored(TRIPS_KEY, tripListSchema, []);
    const next = [trip, ...existing.filter((item) => item.id !== trip.id)].sort((a, b) => b.startedAt - a.startedAt);
    await writeStored(TRIPS_KEY, next);
    return next;
  },
  async removeAll() {
    await removeStored(TRIPS_KEY);
    await removeStored(DRAFT_KEY);
  },
  async readDraft() {
    return readStored(DRAFT_KEY, tripDraftSchema.nullable(), null);
  },
  async saveDraft(draft) {
    await writeStored(DRAFT_KEY, draft);
  },
  async clearDraft() {
    await removeStored(DRAFT_KEY);
  },
};
