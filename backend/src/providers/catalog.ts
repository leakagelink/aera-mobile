export type ProviderSlug = 'gemini' | 'tomtom' | 'openweather' | 'osrm' | 'nominatim' | 'martin';
export type ProviderType = 'ai' | 'traffic' | 'weather' | 'routing' | 'geocoding' | 'map';

export type ProviderCatalogEntry = {
  provider: ProviderSlug;
  providerType: ProviderType;
  name: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
};

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  { provider: 'gemini', providerType: 'ai', name: 'Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com', requiresApiKey: true },
  { provider: 'tomtom', providerType: 'traffic', name: 'TomTom', defaultBaseUrl: 'https://api.tomtom.com', requiresApiKey: true },
  { provider: 'openweather', providerType: 'weather', name: 'OpenWeather', defaultBaseUrl: 'https://api.openweathermap.org', requiresApiKey: true },
  { provider: 'osrm', providerType: 'routing', name: 'OSRM', defaultBaseUrl: 'https://router.project-osrm.org', requiresApiKey: false },
  { provider: 'nominatim', providerType: 'geocoding', name: 'Nominatim', defaultBaseUrl: 'https://nominatim.openstreetmap.org', requiresApiKey: false },
  { provider: 'martin', providerType: 'map', name: 'Martin', defaultBaseUrl: '', requiresApiKey: false },
];

export function catalogEntry(provider: string): ProviderCatalogEntry | null {
  return PROVIDER_CATALOG.find((entry) => entry.provider === provider) ?? null;
}

export type ProviderHealthStatus = 'CONNECTED' | 'ERROR' | 'DISABLED' | 'NOT CONFIGURED';

export function providerStatus(input: { configured: boolean; enabled: boolean; lastTestStatus: 'success' | 'failure' | null }): ProviderHealthStatus {
  if (!input.configured) return 'NOT CONFIGURED';
  if (!input.enabled) return 'DISABLED';
  if (input.lastTestStatus === 'failure') return 'ERROR';
  if (input.lastTestStatus === 'success') return 'CONNECTED';
  return 'NOT CONFIGURED';
}
