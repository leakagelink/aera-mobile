import { env } from '@/services/env';

/**
 * MapLibre style configuration.
 * Expo SDK 57 / React Native 0.86 always run the New Architecture, which
 * MapLibre React Native 11 requires. There is no separate architecture toggle.
 */
export function getMapStyleUrl(): string {
  return env.mapStyleUrl;
}
