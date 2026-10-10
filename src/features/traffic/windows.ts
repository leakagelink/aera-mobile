import type { Coordinate } from '@/types/location';
import { distanceMeters } from '@/utils/geo';

export function routeWindows(coordinates: Coordinate[], count = 4, radiusMeters = 500): { point: Coordinate; coordinates: Coordinate[] }[] {
  if (coordinates.length < 2) return [];
  const seen = new Set<string>();
  const windows: { point: Coordinate; coordinates: Coordinate[] }[] = [];
  for (const index of sampleIndexes(coordinates.length, Math.min(count, coordinates.length))) {
    const point = coordinates[index];
    if (!point) continue;
    const key = `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const line = stretchAround(coordinates, index, radiusMeters);
    if (line.length >= 2) windows.push({ point, coordinates: line });
  }
  return windows.slice(0, count);
}

function sampleIndexes(length: number, count: number): number[] {
  if (count <= 1) return [0];
  const last = length - 1;
  return Array.from({ length: count }, (_, index) => Math.round((index * last) / (count - 1)));
}

function stretchAround(route: Coordinate[], index: number, radiusMeters: number): Coordinate[] {
  let start = index;
  let walked = 0;
  while (start > 0 && walked < radiusMeters) {
    const previous = route[start - 1];
    const current = route[start];
    if (!previous || !current) break;
    walked += distanceMeters(current, previous);
    start -= 1;
  }
  let end = index;
  walked = 0;
  while (end < route.length - 1 && walked < radiusMeters) {
    const current = route[end];
    const next = route[end + 1];
    if (!current || !next) break;
    walked += distanceMeters(current, next);
    end += 1;
  }
  return route.slice(start, end + 1);
}
