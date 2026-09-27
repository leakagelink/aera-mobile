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
    projected,
  };
}

export type RouteProgress = {
  traveledMeters: number;
  remainingMeters: number;
  totalMeters: number;
  fraction: number;
};

export type RouteMatch = RouteProgress & {
  snapped: Coordinate;
  segmentIndex: number;
  crossTrackMeters: number;
  offRoute: boolean;
};

export type RouteMatchHint = {
  segmentIndex: number;
  traveledMeters: number;
};

const OFF_ROUTE_METERS = 50;

type Projection = {
  segmentIndex: number;
  traveledMeters: number;
  crossTrackMeters: number;
  snapped: Coordinate;
};

function projectOnto(point: Coordinate, geometry: Coordinate[], startIndex: number): { best: Projection; totalMeters: number } | null {
  if (geometry.length < 2) return null;
  const prefix = [0];
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    const length = start && end ? distanceMeters(start, end) : 0;
    prefix.push((prefix[index] ?? 0) + length);
  }
  const totalMeters = prefix[prefix.length - 1] ?? 0;
  let best: Projection | null = null;
  for (let index = startIndex; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    if (!start || !end) continue;
    const segment = projectSegment(point, start, end);
    if (!best || segment.distanceMeters < best.crossTrackMeters) {
      best = {
        segmentIndex: index,
        traveledMeters: (prefix[index] ?? 0) + segment.alongMeters,
        crossTrackMeters: segment.distanceMeters,
        snapped: segment.projected,
      };
    }
  }
  return best ? { best, totalMeters } : null;
}

function emptyMatch(point: Coordinate): RouteMatch {
  return {
    snapped: point,
    segmentIndex: -1,
    crossTrackMeters: 0,
    traveledMeters: 0,
    remainingMeters: 0,
    totalMeters: 0,
    fraction: 0,
    offRoute: true,
  };
}

export function matchToRoute(point: Coordinate, geometry: Coordinate[], hint?: RouteMatchHint | null): RouteMatch {
  const full = projectOnto(point, geometry, 0);
  if (!full) return emptyMatch(point);

  let chosen = full.best;
  if (hint && hint.segmentIndex >= 0) {
    const forward = projectOnto(point, geometry, Math.max(0, hint.segmentIndex - 1));
    if (forward && forward.best.crossTrackMeters <= full.best.crossTrackMeters + 25) {
      chosen = forward.best;
    }
  }

  const traveled = Math.min(full.totalMeters, Math.max(0, chosen.traveledMeters));
  return {
    snapped: chosen.snapped,
    segmentIndex: chosen.segmentIndex,
    crossTrackMeters: chosen.crossTrackMeters,
    traveledMeters: traveled,
    remainingMeters: Math.max(0, full.totalMeters - traveled),
    totalMeters: full.totalMeters,
    fraction: full.totalMeters > 0 ? traveled / full.totalMeters : 0,
    offRoute: chosen.crossTrackMeters > OFF_ROUTE_METERS,
  };
}

export function progressAlongRoute(point: Coordinate, geometry: Coordinate[]): RouteProgress {
  const match = matchToRoute(point, geometry);
  return {
    traveledMeters: match.traveledMeters,
    remainingMeters: match.remainingMeters,
    totalMeters: match.totalMeters,
    fraction: match.fraction,
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
