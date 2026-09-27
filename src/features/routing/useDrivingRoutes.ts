import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { routingProvider } from '@/services/providers';
import { useLocationStore } from '@/store/locationStore';
import { useSessionStore } from '@/store/sessionStore';
import { AppError } from '@/utils/errors';
import { distanceMeters, stableCoordinate } from '@/utils/geo';

export function useDrivingRoutes(enabled: boolean) {
  const destination = useSessionStore((state) => state.destination);
  const location = useLocationStore((state) => state.current);
  const setRoutes = useSessionStore((state) => state.setRoutes);
  const origin = location ? stableCoordinate(location) : null;

  const query = useQuery({
    queryKey: ['route', destination?.id, origin?.latitude, origin?.longitude],
    enabled: enabled && destination !== null && origin !== null,
    staleTime: 120_000,
    refetchOnMount: false,
    queryFn: ({ signal }) => {
      const current = useLocationStore.getState().current;
      const place = useSessionStore.getState().destination;
      if (!current || !place) throw new AppError('A current location and destination are required.', 'invalid');
      if (distanceMeters(current, place) < 25) {
        throw new AppError('Choose a destination farther from where you are.', 'invalid');
      }
      return routingProvider().calculateRoute(current, place, signal);
    },
  });

  useEffect(() => {
    if (!query.data || !destination) return;
    if (useSessionStore.getState().destination?.id !== destination.id) return;
    setRoutes(query.data);
  }, [query.data, destination, setRoutes]);

  return query;
}
