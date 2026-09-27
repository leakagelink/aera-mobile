import type { Coordinate } from '@/types/location';

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier?: string;
  name?: string;
  location: Coordinate;
};

export type RouteAlternative = {
  id: string;
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  summary: string;
  geometry: Coordinate[];
  steps: RouteStep[];
};
