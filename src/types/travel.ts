export type TravelMode = 'walk' | 'bicycle' | 'motorcycle' | 'car';

export type OsrmProfile = 'foot' | 'bike' | 'driving';

export const TRAVEL_MODES: { id: TravelMode; label: string }[] = [
  { id: 'walk', label: 'Walk' },
  { id: 'bicycle', label: 'Bicycle' },
  { id: 'motorcycle', label: 'Bike' },
  { id: 'car', label: 'Car' },
];

export function osrmProfile(mode: TravelMode): OsrmProfile {
  if (mode === 'walk') return 'foot';
  if (mode === 'bicycle') return 'bike';
  return 'driving';
}

export function travelModeLabel(mode: TravelMode): string {
  return TRAVEL_MODES.find((item) => item.id === mode)?.label ?? 'Car';
}
