import { create } from 'zustand';

import type { AvailabilityState, GeoLocation, PermissionState } from '@/types/location';

type LocationState = {
  permission: PermissionState;
  canAskAgain: boolean;
  availability: AvailabilityState;
  current: GeoLocation | null;
  error: string | null;
  watching: boolean;
  permissionKnown: boolean;
  setCurrent: (location: GeoLocation) => void;
};

export const useLocationStore = create<LocationState>((set) => ({
  permission: 'undetermined',
  canAskAgain: true,
  availability: 'unknown',
  current: null,
  error: null,
  watching: false,
  permissionKnown: false,
  setCurrent: (current) => set({ current, availability: 'available', error: null }),
}));
