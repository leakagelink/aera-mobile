import type { Coordinate } from '@/types/location';

export type TripSample = {
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
};

export type Trip = {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  distanceMeters: number;
  averageSpeedMps: number;
  maxSpeedMps: number;
  sampleCount: number;
  movingTimeSeconds?: number;
  stoppedTimeSeconds?: number;
  samples: TripSample[];
  originName: string;
  destinationName: string;
  routeSummary: string;
  routeProvider?: string;
  plannedGeometry?: Coordinate[];
  routeProgress?: number;
  recovered: boolean;
};

export type TripDraft = {
  id: string;
  startedAt: number;
  originName: string;
  destinationName: string;
  routeSummary: string;
  routeProvider?: string;
  plannedGeometry?: Coordinate[];
  samples: TripSample[];
  pausedAt?: number | null;
  pausedMs?: number;
};
