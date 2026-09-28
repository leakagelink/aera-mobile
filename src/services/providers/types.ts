import type { Coordinate } from '@/types/location';
import type { Place } from '@/types/place';
import type { MatchedTrace, NearestRoad, RouteAlternative } from '@/types/route';
import type { TrafficReport } from '@/types/traffic';
import type { TravelMode } from '@/types/travel';

export interface MapStyleProvider {
  readonly id: 'maplibre';
  styleUrl(): string;
}

export interface PlaceSearchProvider {
  readonly id: string;
  search(query: string, signal?: AbortSignal): Promise<Place[]>;
}

export interface GeocodingProvider {
  readonly id: string;
  reverse(coordinate: Coordinate, signal?: AbortSignal): Promise<Place | null>;
}

export interface RoutingProvider {
  readonly id: string;
  calculateRoute(origin: Coordinate, destination: Coordinate, signal?: AbortSignal, mode?: TravelMode): Promise<RouteAlternative[]>;
  nearestRoad(coordinate: Coordinate, signal?: AbortSignal): Promise<NearestRoad | null>;
  matchTrace(trace: Coordinate[], signal?: AbortSignal): Promise<MatchedTrace | null>;
}

export interface TrafficProvider {
  readonly id: string;
  report(): TrafficReport;
}
