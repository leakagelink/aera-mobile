import { placeSearchProvider, routingProvider } from '@/services/providers';
import { useLocationStore } from '@/store/locationStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { useTripStore } from '@/store/tripStore';
import { beginNavigation, completeNavigation } from '@/features/navigation/session';
import { navigationSnapshot } from '@/features/navigation/progress';
import { roadNameAtDistance, segmentAt } from '@/features/routing/segments';
import { computeTripMetrics } from '@/features/trips/metrics';
import type { Coordinate } from '@/types/location';
import { AppError } from '@/utils/errors';
import { distanceMeters, isValidCoordinate } from '@/utils/geo';

export const aeraToolNames = [
  'getCurrentLocation',
  'searchPlace',
  'calculateRoute',
  'getAlternativeRoutes',
  'getETA',
  'startTrip',
  'stopTrip',
  'getCurrentSpeed',
  'getTripStats',
  'getTripHistory',
  'getRoadHistory',
] as const;

export type AeraToolName = (typeof aeraToolNames)[number];

export async function runAeraTool(name: AeraToolName, input: Record<string, unknown> = {}): Promise<unknown> {
  switch (name) {
    case 'getCurrentLocation':
      return getCurrentLocation();
    case 'searchPlace':
      return placeSearchProvider().search(readString(input, 'query'));
    case 'calculateRoute':
      return calculateRoute(readCoordinate(input));
    case 'getAlternativeRoutes':
      return useSessionStore.getState().routes;
    case 'getETA':
      return getETA();
    case 'startTrip':
      await beginNavigation();
      return { started: true };
    case 'stopTrip':
      return completeNavigation();
    case 'getCurrentSpeed':
      return useLocationStore.getState().current?.speed ?? null;
    case 'getTripStats':
      return getTripStats();
    case 'getTripHistory':
      return useTripStore.getState().trips.map((trip) => ({
        id: trip.id,
        startedAt: trip.startedAt,
        endedAt: trip.endedAt,
        originName: trip.originName,
        destinationName: trip.destinationName,
        distanceMeters: trip.distanceMeters,
        durationSeconds: trip.durationSeconds,
        sampleCount: trip.sampleCount,
      }));
    case 'getRoadHistory':
      return getRoadHistory(readCoordinate(input), readRadius(input));
    default:
      throw new AppError('That navigation tool is not available.', 'unavailable');
  }
}

function getCurrentLocation() {
  const location = useLocationStore.getState().current;
  if (!location) return null;
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    altitude: location.altitude,
    heading: location.heading,
    speed: location.speed,
    timestamp: location.timestamp,
  };
}

async function calculateRoute(destination: Coordinate) {
  const origin = useLocationStore.getState().current;
  if (!origin) throw new AppError('Current location is not available.', 'unavailable');
  return routingProvider().calculateRoute(origin, destination);
}

function getETA() {
  const location = useLocationStore.getState().current;
  const route = selectedRoute(useSessionStore.getState());
  if (!location || !route) return null;
  const snapshot = navigationSnapshot(location, location.speed, route);
  const segment = segmentAt(route, snapshot.segmentIndex, snapshot.traveledMeters);
  return {
    eta: snapshot.eta,
    remainingSeconds: snapshot.remainingSeconds,
    remainingMeters: snapshot.remainingMeters,
    fraction: snapshot.fraction,
    offRoute: snapshot.offRoute,
    roadName: snapshot.roadName ?? roadNameAtDistance(route.steps, snapshot.traveledMeters),
    segment,
  };
}

function getTripStats() {
  const draft = useTripStore.getState().draft;
  const now = Date.now();
  if (draft) return computeTripMetrics(draft.samples, draft.startedAt, now);
  const latest = useTripStore.getState().trips[0];
  return latest ?? null;
}

function getRoadHistory(coordinate: Coordinate, radiusMeters: number) {
  const matches = [];
  for (const trip of useTripStore.getState().trips) {
    for (const sample of trip.samples) {
      const distance = distanceMeters(coordinate, sample);
      if (distance > radiusMeters) continue;
      matches.push({
        tripId: trip.id,
        timestamp: sample.timestamp,
        latitude: sample.latitude,
        longitude: sample.longitude,
        speed: sample.speed,
        distanceMeters: distance,
      });
      if (matches.length >= 30) return matches;
    }
  }
  return matches;
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length < 2) {
    throw new AppError('A place query is required.', 'invalid');
  }
  return value.trim();
}

function readCoordinate(input: Record<string, unknown>): Coordinate {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!isValidCoordinate(latitude, longitude)) {
    throw new AppError('A valid latitude and longitude are required.', 'invalid');
  }
  return { latitude, longitude };
}

function readRadius(input: Record<string, unknown>): number {
  const radius = Number(input.radiusMeters);
  if (!Number.isFinite(radius) || radius <= 0) return 40;
  return Math.min(radius, 500);
}
