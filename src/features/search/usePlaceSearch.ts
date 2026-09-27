import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { readRecentPlaces, rememberPlace } from '@/data/searchHistory';
import { searchPlaces } from '@/services/nominatim';
import type { Place } from '@/types/place';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

export function usePlaceSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 500);
  return useQuery({
    queryKey: ['places', debounced.toLowerCase()],
    queryFn: ({ signal }) => searchPlaces(debounced, signal),
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
