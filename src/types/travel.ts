import { t } from '@/i18n';

export type TravelMode = 'walk' | 'bicycle' | 'motorcycle' | 'car';

export type OsrmProfile = 'foot' | 'bike' | 'driving';

export const TRAVEL_MODES: { id: TravelMode; label: TravelMode }[] = [
  { id: 'walk', label: 'walk' },
  { id: 'bicycle', label: 'bicycle' },
  { id: 'motorcycle', label: 'motorcycle' },
  { id: 'car', label: 'car' },
];

export function osrmProfile(mode: TravelMode): OsrmProfile {
  if (mode === 'walk') return 'foot';
  if (mode === 'bicycle') return 'bike';
  return 'driving';
}

export function travelModeLabel(mode: TravelMode): string {
  if (mode === 'walk') return t('mode.walk');
  if (mode === 'bicycle') return t('mode.bicycle');
  if (mode === 'motorcycle') return t('mode.motorcycle');
  return t('mode.car');
}
