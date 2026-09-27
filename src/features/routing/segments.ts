import type { Coordinate } from '@/types/location';
import type { RouteAlternative, RouteStep } from '@/types/route';
import { distanceMeters } from '@/utils/geo';

export type RouteSegment = {
  index: number;
  start: Coordinate;
  end: Coordinate;
  lengthMeters: number;
  startMeters: number;
  roadName?: string;
};

export function roadNameAtDistance(steps: RouteStep[], traveledMeters: number): string | undefined {
  let cursor = 0;
  let current: string | undefined;
  for (const step of steps) {
    const next = cursor + Math.max(0, step.distanceMeters);
    if (traveledMeters <= next) return step.name || current;
    current = step.name || current;
    cursor = next;
  }
  return current;
}

export function segmentAt(route: RouteAlternative, index: number, traveledMeters: number): RouteSegment | null {
  const start = route.geometry[index];
  const end = route.geometry[index + 1];
  if (!start || !end || index < 0) return null;
  let startMeters = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const from = route.geometry[cursor];
    const to = route.geometry[cursor + 1];
    if (!from || !to) continue;
    startMeters += route.annotations?.segmentDistancesMeters[cursor] ?? distanceMeters(from, to);
  }
  return {
    index,
    start,
    end,
    lengthMeters: route.annotations?.segmentDistancesMeters[index] ?? distanceMeters(start, end),
    startMeters,
    roadName: roadNameAtDistance(route.steps, traveledMeters),
  };
}
