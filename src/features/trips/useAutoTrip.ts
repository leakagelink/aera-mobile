import { useEffect, useRef } from 'react';

import { computeTripMetrics } from '@/features/trips/metrics';
import { geocodingProvider } from '@/services/providers';
import { useHabitStore } from '@/store/habitStore';
import { useLocationStore } from '@/store/locationStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTripStore } from '@/store/tripStore';
import type { GeoLocation } from '@/types/location';
import { distanceMeters } from '@/utils/geo';

const STOP_MS = 120_000;
const MIN_TRIP_METERS = 200;
const START_METERS = 40;

export function useAutoTrip(active: boolean): void {
  const location = useLocationStore((state) => state.current);
  const stoppedSince = useRef<number | null>(null);
  const lastEnd = useRef<GeoLocation | null>(null);
  const previous = useRef<GeoLocation | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    void useTripStore.getState().hydrate();
    void useHabitStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!active || !location || busy.current) return;
    const moved = previous.current ? distanceMeters(previous.current, location) : 0;
    previous.current = location;
    const draft = useTripStore.getState().draft;
    if (draft?.plannedGeometry) return;
    const stopped = isStopped(location) || (location.speed === null && previous.current !== null && moved < 8);
    const moving = isMoving(location) || (location.speed === null && moved > 25);
    if (draft) {
      void useTripStore.getState().appendSample(sampleOf(location));
      if (!stopped) {
        stoppedSince.current = null;
        return;
      }
      if (stoppedSince.current === null) {
        stoppedSince.current = location.timestamp;
        return;
      }
      if (location.timestamp - stoppedSince.current < STOP_MS) return;
      const metrics = computeTripMetrics(draft.samples, draft.startedAt, location.timestamp);
      busy.current = true;
      void closeStoppedTrip(location, metrics.distanceMeters)
        .catch(() => undefined)
        .finally(() => {
          busy.current = false;
          stoppedSince.current = null;
          lastEnd.current = location;
        });
      return;
    }
    if (!moving) return;
    if (lastEnd.current && distanceMeters(lastEnd.current, location) < START_METERS) return;
    busy.current = true;
    void startMovingTrip(location)
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
      });
  }, [active, location]);
}

async function closeStoppedTrip(location: GeoLocation, distance: number): Promise<void> {
  const draft = useTripStore.getState().draft;
  if (!draft || draft.plannedGeometry) return;
  const destinationName = await placeName(location, useSessionStore.getState().destination);
  if (distance < MIN_TRIP_METERS) {
    await useTripStore.getState().abandonDraft();
    return;
  }
  await useTripStore.getState().renameDraft(draft.originName, destinationName);
  const trip = await useTripStore.getState().finishDraft();
  const origin = trip.samples[0];
  const end = trip.samples[trip.samples.length - 1];
  if (!origin || !end) return;
  await useHabitStore.getState().learnTrip({
    origin,
    originName: trip.originName,
    destination: end,
    destinationName,
    durationSeconds: trip.durationSeconds,
    distanceMeters: trip.distanceMeters,
  });
}

async function startMovingTrip(location: GeoLocation): Promise<void> {
  if (useTripStore.getState().draft) return;
  const chosen = useSessionStore.getState().destination;
  await useTripStore.getState().startDraft({
    originName: await placeName(location, null),
    destinationName: chosen?.name ?? 'On the way',
    routeSummary: 'Automatic trip',
    initialSample: sampleOf(location),
  });
}

async function placeName(location: GeoLocation, chosen: { name: string; latitude: number; longitude: number } | null): Promise<string> {
  if (chosen && distanceMeters(location, chosen) < 200) return chosen.name;
  try {
    const place = await geocodingProvider().reverse(location);
    if (place?.name) return place.name;
  } catch {
    return 'Saved stop';
  }
  return 'Saved stop';
}

function isStopped(location: GeoLocation): boolean {
  return location.speed !== null && location.speed < 0.7;
}

function isMoving(location: GeoLocation): boolean {
  return location.speed !== null && location.speed >= 1.2;
}

function sampleOf(location: GeoLocation) {
  return {
    timestamp: location.timestamp,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    speed: location.speed,
    heading: location.heading,
    altitude: location.altitude,
  };
}
