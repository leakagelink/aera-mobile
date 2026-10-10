import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { readRecentPlaces, rememberPlace } from '@/data/searchHistory';
import { placeSearchProvider } from '@/services/providers';
import { useLocationStore } from '@/store/locationStore';
import type { Place } from '@/types/place';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

export function usePlaceSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 500);
  const location = useLocationStore((state) => state.current);
  const area = location ? `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}` : 'any';
  return useQuery({
    queryKey: ['places', debounced.toLowerCase(), area],
    queryFn: ({ signal }) =>
      placeSearchProvider().search(debounced, signal, location ? { latitude: location.latitude, longitude: location.longitude } : undefined),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
}

export function useRecentPlaces() {
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    let active = true;
    void readRecentPlaces().then((next) => {
      if (active) setPlaces(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function remember(place: Place) {
    const next = await rememberPlace(place);
    setPlaces(next);
  }

  return { places, remember };
}
