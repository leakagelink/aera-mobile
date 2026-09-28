import { env } from '@/services/env';
import { getMapStyleUrl } from '@/services/mapStyle';
import { reverseGeocode, searchPlaces } from '@/services/nominatim';
import { fetchRoutes, matchTrace, nearestRoad } from '@/services/osrm';
import { osrmProfile } from '@/types/travel';
import type { GeocodingProvider, MapStyleProvider, PlaceSearchProvider, RoutingProvider, TrafficProvider } from '@/services/providers/types';
import type { TrafficReport } from '@/types/traffic';
import { AppError } from '@/utils/errors';

const nominatim: PlaceSearchProvider & GeocodingProvider = {
  id: 'nominatim',
  search: searchPlaces,
  reverse: reverseGeocode,
};

const osrm: RoutingProvider = {
  id: 'osrm',
  calculateRoute: (origin, destination, signal, mode = 'car') => fetchRoutes(origin, destination, osrmProfile(mode), mode, signal),
  nearestRoad,
  matchTrace,
};

const mapStyle: MapStyleProvider = {
  id: 'maplibre',
  styleUrl: getMapStyleUrl,
};

const unavailableTraffic: TrafficProvider = {
  id: 'unavailable',
  report(): TrafficReport {
    return { available: false, reason: 'not_configured', segments: [] };
  },
};

function requireProvider(configured: string, supported: string, label: string): void {
  if (configured === supported) return;
  throw new AppError(
    `The ${label} provider "${configured}" is not connected yet. Keep ${supported} until the Arah service is available.`,
    'unavailable',
  );
}

export function mapStyleProvider(): MapStyleProvider {
  return mapStyle;
}

export function placeSearchProvider(): PlaceSearchProvider {
  requireProvider(env.geocodingProvider, 'nominatim', 'search');
  return nominatim;
}

export function geocodingProvider(): GeocodingProvider {
  requireProvider(env.geocodingProvider, 'nominatim', 'geocoding');
  return nominatim;
}

export function routingProvider(): RoutingProvider {
  requireProvider(env.routingProvider, 'osrm', 'routing');
  return osrm;
}

export function trafficProvider(): TrafficProvider {
  return unavailableTraffic;
}

export type { GeocodingProvider, MapStyleProvider, PlaceSearchProvider, RoutingProvider, TrafficProvider };
