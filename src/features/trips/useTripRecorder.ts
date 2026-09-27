import { useEffect, useRef } from 'react';

import { useLocationStore } from '@/store/locationStore';
import { useTripStore } from '@/store/tripStore';

export function useTripRecorder(active: boolean): void {
  const location = useLocationStore((state) => state.current);
  const lastTimestamp = useRef(0);

  useEffect(() => {
    if (!active || !location) return;
    if (location.timestamp <= lastTimestamp.current) return;
    lastTimestamp.current = location.timestamp;
    void useTripStore.getState().appendSample({
      timestamp: location.timestamp,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      altitude: location.altitude,
    });
  }, [active, location]);
}
