import type { Coordinate } from '@/types/location';
import { distanceMeters } from '@/utils/geo';

export const HABIT_MATCH_METERS = 150;

export type HabitPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  visits: number;
};

export type HabitLeg = {
  fromId: string;
  toId: string;
  trips: number;
  fastestSeconds: number;
  distanceMeters: number;
};

export function nearestPlace(places: HabitPlace[], coordinate: Coordinate, withinMeters = HABIT_MATCH_METERS): HabitPlace | null {
  let best: HabitPlace | null = null;
  let bestDistance = withinMeters;
  for (const place of places) {
    const distance = distanceMeters(place, coordinate);
    if (distance <= bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

export function upsertPlace(places: HabitPlace[], coordinate: Coordinate, name: string, id: string): { places: HabitPlace[]; place: HabitPlace } {
  const existing = nearestPlace(places, coordinate);
  if (existing) {
    const place = { ...existing, name: name.trim() || existing.name, visits: existing.visits + 1, latitude: coordinate.latitude, longitude: coordinate.longitude };
    return { place, places: places.map((item) => (item.id === existing.id ? place : item)) };
  }
  const place: HabitPlace = { id, name: name.trim() || 'Saved stop', latitude: coordinate.latitude, longitude: coordinate.longitude, visits: 1 };
  return { place, places: [place, ...places].slice(0, 30) };
}

export function rememberLeg(legs: HabitLeg[], fromId: string, toId: string, durationSeconds: number, distanceMetersValue: number): HabitLeg[] {
  if (fromId === toId || durationSeconds <= 0 || distanceMetersValue < 150) return legs;
  const current = legs.find((leg) => leg.fromId === fromId && leg.toId === toId);
  const next: HabitLeg = current
    ? {
        ...current,
        trips: current.trips + 1,
        fastestSeconds: Math.min(current.fastestSeconds, durationSeconds),
        distanceMeters: distanceMetersValue,
      }
    : { fromId, toId, trips: 1, fastestSeconds: durationSeconds, distanceMeters: distanceMetersValue };
  return [next, ...legs.filter((leg) => !(leg.fromId === fromId && leg.toId === toId))].slice(0, 40);
}

export function usualDestinations(places: HabitPlace[], legs: HabitLeg[], coordinate: Coordinate): { from: HabitPlace; to: HabitPlace; trips: number; fastestSeconds: number }[] {
  const from = nearestPlace(places, coordinate, 250);
  if (!from) return [];
  return legs
    .filter((leg) => leg.fromId === from.id && leg.trips >= 2)
    .flatMap((leg) => {
      const to = places.find((place) => place.id === leg.toId);
      return to ? [{ from, to, trips: leg.trips, fastestSeconds: leg.fastestSeconds }] : [];
    })
    .sort((left, right) => right.trips - left.trips || left.fastestSeconds - right.fastestSeconds)
    .slice(0, 3);
}
