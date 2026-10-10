import { create } from 'zustand';
import { z } from 'zod';

import { readStored, writeStored } from '@/data/storage';
import { rememberLeg, upsertPlace, type HabitLeg, type HabitPlace } from '@/features/trips/habits';
import type { Coordinate } from '@/types/location';
import { createId } from '@/utils/id';

const KEY = 'aera.habits.v1';

const schema = z.object({
  places: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      visits: z.number(),
    }),
  ),
  legs: z.array(
    z.object({
      fromId: z.string(),
      toId: z.string(),
      trips: z.number(),
      fastestSeconds: z.number(),
      distanceMeters: z.number(),
    }),
  ),
});

type HabitState = {
  places: HabitPlace[];
  legs: HabitLeg[];
  ready: boolean;
  hydrate: () => Promise<void>;
  learnTrip: (input: {
    origin: Coordinate;
    originName: string;
    destination: Coordinate;
    destinationName: string;
    durationSeconds: number;
    distanceMeters: number;
  }) => Promise<void>;
};

let hydration: Promise<void> | null = null;

export const useHabitStore = create<HabitState>((set, get) => ({
  places: [],
  legs: [],
  ready: false,
  hydrate() {
    if (!hydration) {
      hydration = readStored(KEY, schema, { places: [], legs: [] }).then((stored) => {
        set({ places: stored.places, legs: stored.legs, ready: true });
      });
    }
    return hydration;
  },
  async learnTrip(input) {
    if (!get().ready) await get().hydrate();
    const origin = upsertPlace(get().places, input.origin, input.originName, createId('place'));
    const destination = upsertPlace(origin.places, input.destination, input.destinationName, createId('place'));
    const legs = rememberLeg(get().legs, origin.place.id, destination.place.id, input.durationSeconds, input.distanceMeters);
    set({ places: destination.places, legs });
    await writeStored(KEY, { places: destination.places, legs });
  },
}));
