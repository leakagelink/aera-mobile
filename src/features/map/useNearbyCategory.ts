import { useEffect, useState } from 'react';

import { nearbyCategoryPlaces } from '@/services/nominatim';
import type { GeoLocation } from '@/types/location';
import type { Place } from '@/types/place';

const emptyPlaces: Place[] = [];

export function useNearbyCategory(
  location: GeoLocation | null,
  category: string | null,
  radiusMeters: number,
): { places: Place[]; loading: boolean } {
  const [result, setResult] = useState<{ key: string; places: Place[] } | null>(null);
  const latitude = location ? Number(location.latitude.toFixed(3)) : null;
  const longitude = location ? Number(location.longitude.toFixed(3)) : null;
  const key = category && latitude != null && longitude != null ? `${category}:${radiusMeters}:${latitude},${longitude}` : null;

  useEffect(() => {
    if (!category || !key || latitude == null || longitude == null) return;
    const coordinate = { latitude, longitude };
    const requestKey = key;
    const controller = new AbortController();
    void (async () => {
      try {
        const places = await nearbyCategoryPlaces(coordinate, category, radiusMeters, controller.signal);
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, places });
      } catch {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, places: [] });
      }
    })();
    return () => controller.abort();
  }, [category, key, latitude, longitude, radiusMeters]);

  return {
    places: result?.key === key ? result.places : emptyPlaces,
    loading: key != null && result?.key !== key,
  };
}
