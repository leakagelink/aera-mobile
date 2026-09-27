import type { AppConfig } from '../config/load-config';
import { NominatimProvider } from './nominatim.provider';
import { OsrmProvider } from './osrm.provider';
import { UnavailableTrafficProvider } from './traffic.provider';
import type { GeocodingProvider, PlaceSearchProvider, RoutingProvider, TrafficProvider } from './types';

export type ProviderSet = {
  search: PlaceSearchProvider;
  geocoding: GeocodingProvider;
  routing: RoutingProvider;
  traffic: TrafficProvider;
};

export function createProviders(config: Pick<AppConfig, 'geocodingProvider' | 'geocodingBaseUrl' | 'geocodingUserAgent' | 'routingProvider' | 'routingBaseUrl'>): ProviderSet {
  if (config.geocodingProvider !== 'nominatim') {
    throw new Error(`Geocoding provider "${config.geocodingProvider}" is not connected.`);
  }
  if (config.routingProvider !== 'osrm') {
    throw new Error(`Routing provider "${config.routingProvider}" is not connected.`);
  }
  const nominatim = new NominatimProvider(config.geocodingBaseUrl, config.geocodingUserAgent);
  return {
    search: nominatim,
    geocoding: nominatim,
    routing: new OsrmProvider(config.routingBaseUrl, config.geocodingUserAgent),
    traffic: new UnavailableTrafficProvider(),
  };
}
