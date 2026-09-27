import type { Coordinate } from '@/types/location';

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function projectSegment(point: Coordinate, start: Coordinate, end: Coordinate) {
  const latScale = 111_320;
  const lonScale = Math.cos(toRadians((start.latitude + end.latitude) / 2)) * 111_320;
  const ax = start.longitude * lonScale;
  const ay = start.latitude * latScale;
  const bx = end.longitude * lonScale;
  const by = end.latitude * latScale;
  const px = point.longitude * lonScale;
  const py = point.latitude * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const projected: Coordinate = {
    latitude: start.latitude + (end.latitude - start.latitude) * t,
    longitude: start.longitude + (end.longitude - start.longitude) * t,
  };
  return {
    alongMeters: distanceMeters(start, end) * t,
    distanceMeters: distanceMeters(point, projected),
  };
}

export type RouteProgress = {
  traveledMeters: number;
  remainingMeters: number;
  totalMeters: number;
  fraction: number;
};

export function progressAlongRoute(point: Coordinate, geometry: Coordinate[]): RouteProgress {
  if (geometry.length < 2) {
    return { traveledMeters: 0, remainingMeters: 0, totalMeters: 0, fraction: 0 };
  }

  let traveledBefore = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestTraveled = 0;

  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    if (!start || !end) continue;
    const segment = projectSegment(point, start, end);
    if (segment.distanceMeters < bestDistance) {
      bestDistance = segment.distanceMeters;
      bestTraveled = traveledBefore + segment.alongMeters;
    }
    traveledBefore += distanceMeters(start, end);
  }

  const total = traveledBefore;
  const traveled = Math.min(total, Math.max(0, bestTraveled));
  return {
    traveledMeters: traveled,
    remainingMeters: Math.max(0, total - traveled),
    totalMeters: total,
    fraction: total > 0 ? traveled / total : 0,
  };
}

export function paddedBounds(coordinates: Coordinate[]): [number, number, number, number] | null {
  if (coordinates.length === 0) return null;
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const coordinate of coordinates) {
    west = Math.min(west, coordinate.longitude);
    east = Math.max(east, coordinate.longitude);
    south = Math.min(south, coordinate.latitude);
    north = Math.max(north, coordinate.latitude);
  }
  const latitudePad = Math.max((north - south) * 0.18, 0.004);
  const longitudePad = Math.max((east - west) * 0.18, 0.004);
  return [west - longitudePad, south - latitudePad, east + longitudePad, north + latitudePad];
}

export function stableCoordinate(coordinate: Coordinate, decimals = 3): Coordinate {
  const factor = 10 ** decimals;
  return {
    latitude: Math.round(coordinate.latitude * factor) / factor,
    longitude: Math.round(coordinate.longitude * factor) / factor,
  };
}
