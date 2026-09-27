import type { Coordinate } from '@/types/location';

export type RouteProviderId = 'osrm';

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  name?: string;
  location: Coordinate;
};

export type RouteAnnotations = {
  segmentDistancesMeters: number[];
  segmentDurationsSeconds: number[];
};

export type RouteAlternative = {
  id: string;
  provider: RouteProviderId;
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  summary: string;
  geometry: Coordinate[];
  steps: RouteStep[];
  annotations?: RouteAnnotations;
};

export type NearestRoad = {
  location: Coordinate;
  distanceMeters: number;
  name?: string;
};

export type MatchedTrace = {
  geometry: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  traceSimplified: boolean;
};
