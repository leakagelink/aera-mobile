import { geocodingProvider } from '@/services/providers';
import { useLocationStore } from '@/store/locationStore';
import { selectedRoute, useSessionStore } from '@/store/sessionStore';
import { useTripStore } from '@/store/tripStore';
import type { TripSample } from '@/types/trip';
import { AppError } from '@/utils/errors';

export async function beginNavigation(): Promise<void> {
  const session = useSessionStore.getState();
  const location = useLocationStore.getState().current;
  const route = selectedRoute(session);
  if (!location || !route || !session.destination) {
    throw new AppError('A location, destination, and route are required before navigation can start.', 'invalid');
  }

  let originName = 'Current location';
  try {
    const place = await geocodingProvider().reverse(location);
    if (place?.name) originName = place.name;
  } catch {
    originName = 'Current location';
  }

  const initialSample: TripSample = {
    timestamp: location.timestamp,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    speed: location.speed,
    heading: location.heading,
    altitude: location.altitude,
  };

  await useTripStore.getState().startDraft({
    originName,
    destinationName: session.destination.name,
    routeSummary: route.summary,
    routeProvider: route.provider,
    plannedGeometry: route.geometry,
    initialSample,
  });
}

export async function completeNavigation() {
  const trip = await useTripStore.getState().finishDraft();
  useSessionStore.getState().setCompletedTrip(trip);
  return trip;
}
