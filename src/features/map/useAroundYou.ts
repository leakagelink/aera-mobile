import { useEffect, useState } from 'react';

import { nearbyPlaces } from '@/services/nominatim';
import { geocodingProvider } from '@/services/providers';
import type { GeoLocation } from '@/types/location';
import type { Place } from '@/types/place';

export function useAroundYou(location: GeoLocation | null): { here: string | null; nearby: Place[] } {
  const [here, setHere] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Place[]>([]);
  const latitude = location ? Number(location.latitude.toFixed(3)) : null;
  const longitude = location ? Number(location.longitude.toFixed(3)) : null;

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const coordinate = { latitude, longitude };
    const controller = new AbortController();
    void (async () => {
      const [place, places] = await Promise.all([
        geocodingProvider().reverse(coordinate, controller.signal).catch(() => null),
        nearbyPlaces(coordinate, controller.signal).catch(() => [] as Place[]),
      ]);
      if (controller.signal.aborted) return;
      setHere(place?.name ?? null);
      setNearby(places);
    })();
    return () => controller.abort();
  }, [latitude, longitude]);

  if (latitude == null || longitude == null) return { here: null, nearby: [] };
  return { here, nearby };
}
