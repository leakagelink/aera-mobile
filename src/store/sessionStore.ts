import { create } from 'zustand';

import type { Place } from '@/types/place';
import type { RouteAlternative } from '@/types/route';
import type { TravelMode } from '@/types/travel';
import type { Trip } from '@/types/trip';

type SessionState = {
  origin: Place | null;
  destination: Place | null;
  travelMode: TravelMode;
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  completedTrip: Trip | null;
  setOrigin: (place: Place | null) => void;
  setDestination: (place: Place | null) => void;
  setTravelMode: (mode: TravelMode) => void;
  setRoutes: (routes: RouteAlternative[]) => void;
  selectRoute: (id: string) => void;
  setCompletedTrip: (trip: Trip | null) => void;
  clearJourney: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  origin: null,
  destination: null,
  travelMode: 'car',
  routes: [],
  selectedRouteId: null,
  completedTrip: null,
  setOrigin: (origin) => set({ origin, routes: [], selectedRouteId: null }),
  setDestination: (destination) => set({ destination, routes: [], selectedRouteId: null }),
  setTravelMode: (travelMode) => set({ travelMode, routes: [], selectedRouteId: null }),
  setRoutes: (routes) =>
    set((state) => {
      const selectedStillThere = routes.some((route) => route.id === state.selectedRouteId);
      return {
        routes,
        selectedRouteId: selectedStillThere ? state.selectedRouteId : (routes[0]?.id ?? null),
      };
    }),
  selectRoute: (selectedRouteId) => set({ selectedRouteId }),
  setCompletedTrip: (completedTrip) => set({ completedTrip }),
  clearJourney: () => set({ origin: null, destination: null, routes: [], selectedRouteId: null, completedTrip: null }),
}));

export function selectedRoute(state: Pick<SessionState, 'routes' | 'selectedRouteId'>): RouteAlternative | null {
  return state.routes.find((route) => route.id === state.selectedRouteId) ?? null;
}
