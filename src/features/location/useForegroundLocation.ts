import { useEffect } from 'react';

import { acquireLocation, type WatchMode } from '@/features/location/locationEngine';

export function useForegroundLocation(active: boolean, mode: WatchMode): void {
  useEffect(() => {
    if (!active) return;
    return acquireLocation(mode);
  }, [active, mode]);
}
