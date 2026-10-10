import { aeraApiRequest } from '@/services/api/client';
import type { Coordinate } from '@/types/location';

export type FlowLevel = 'clear' | 'slow' | 'heavy';

export type FlowSample = {
  latitude: number;
  longitude: number;
  level: FlowLevel | null;
};

export async function fetchFlowSamples(points: Coordinate[], signal?: AbortSignal): Promise<{ available: boolean; samples: FlowSample[] }> {
  const params = new URLSearchParams({
    points: points.map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`).join(';'),
  });
  return aeraApiRequest(`/api/v1/traffic/flow?${params.toString()}`, { method: 'GET', signal }) as Promise<{ available: boolean; samples: FlowSample[] }>;
}
