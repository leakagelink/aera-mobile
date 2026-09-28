import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { routingProvider } from '@/services/providers';
import { useLocationStore } from '@/store/locationStore';
import { useSessionStore } from '@/store/sessionStore';
import type { Coordinate } from '@/types/location';
import { AppError } from '@/utils/errors';
import { distanceMeters, stableCoordinate } from '@/utils/geo';

export function useJourneyRoutes(enabled: boolean) {
  const destination = useSessionStore((state) => state.destination);
  const originPlace = useSessionStore((state) => state.origin);
  const travelMode = useSessionStore((state) => state.travelMode);
  const location = useLocationStore((state) => state.current);
  const setRoutes = useSessionStore((state) => state.setRoutes);
  const origin = originPlace ? stableCoordinate(originPlace) : location ? stableCoordinate(location) : null;

  const query = useQuery({
    queryKey: ['route', travelMode, destination?.id, originPlace?.id ?? 'here', origin?.latitude, origin?.longitude],
    enabled: enabled && destination !== null && origin !== null,
    staleTime: 120_000,
    refetchOnMount: false,
    queryFn: ({ signal }) => {
      const session = useSessionStore.getState();
      const place = session.destination;
      const start = journeyStart(session.origin, useLocationStore.getState().current);
      if (!start || !place) throw new AppError('A start and destination are required.', 'invalid');
      if (distanceMeters(start, place) < 25) {
        throw new AppError('Choose a destination farther from the start.', 'invalid');
      }
      return routingProvider().calculateRoute(start, place, signal, session.travelMode);
    },
  });

  useEffect(() => {
    if (!query.data || !destination) return;
    const session = useSessionStore.getState();
    if (session.destination?.id !== destination.id || session.travelMode !== travelMode) return;
    if ((session.origin?.id ?? null) !== (originPlace?.id ?? null)) return;
    setRoutes(query.data);
  }, [query.data, destination, originPlace?.id, setRoutes, travelMode]);

  return query;
}

function journeyStart(origin: { latitude: number; longitude: number } | null, location: Coordinate | null): Coordinate | null {
  return origin ?? location;
}
