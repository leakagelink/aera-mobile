import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { routeWindows } from '@/features/traffic/windows';
import { env } from '@/services/env';
import { fetchFlowSamples } from '@/services/traffic/routeFlow';
import type { Coordinate } from '@/types/location';

export type TrafficLine = {
  id: string;
  coordinates: Coordinate[];
  level: 'clear' | 'slow' | 'heavy';
};

export function useRouteTraffic(geometry: Coordinate[] | null | undefined) {
  const key = geometry?.map((point) => `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`).join('|') ?? '';
  const windows = useMemo(() => routeWindows(geometry ?? []), [key, geometry]);
  const query = useQuery({
    queryKey: ['traffic-flow', windows.map((window) => `${window.point.latitude.toFixed(3)},${window.point.longitude.toFixed(3)}`).join('|')],
    enabled: windows.length > 0 && Boolean(env.aeraApiBaseUrl),
    staleTime: 120_000,
    retry: false,
    queryFn: ({ signal }) => fetchFlowSamples(windows.map((window) => window.point), signal),
  });

  const lines = useMemo<TrafficLine[]>(() => {
    const samples = query.data?.samples ?? [];
    return windows.flatMap((window, index) => {
      const level = samples[index]?.level;
      if (level !== 'clear' && level !== 'slow' && level !== 'heavy') return [];
      return [{ id: `traffic-${index}`, coordinates: window.coordinates, level }];
    });
  }, [query.data, windows]);

  const note =
    !geometry || geometry.length < 2
      ? null
      : !env.aeraApiBaseUrl || query.isError || query.data?.available === false || (query.data && lines.length === 0)
        ? 'Traffic nahi pata'
        : query.data
          ? 'Rang sirf us hisse ka hai jahan traffic mila. Baaki ka traffic nahi pata.'
          : null;

  return { lines, note };
}
