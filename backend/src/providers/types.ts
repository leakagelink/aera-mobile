import type { Coordinate } from '../common/geo';

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type RouteLeg = {
  label: string;
  summary: string;
  distanceMeters: number;
  durationSeconds: number;
  geometry: Coordinate[];
};

export interface PlaceSearchProvider {
  readonly id: string;
  search(query: string): Promise<PlaceResult[]>;
  searchNearby(query: string, coordinate: Coordinate, radiusMeters: number): Promise<PlaceResult[]>;
}

export interface GeocodingProvider {
  readonly id: string;
  reverse(coordinate: Coordinate): Promise<PlaceResult | null>;
}

export interface RoutingProvider {
  readonly id: string;
  calculate(origin: Coordinate, destination: Coordinate): Promise<RouteLeg[]>;
}

export interface TrafficProvider {
  readonly id: 'unavailable';
  report(): { available: false; reason: 'not_configured' };
}
