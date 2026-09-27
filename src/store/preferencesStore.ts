import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemePreference } from '@/theme';
import type { UnitSystem } from '@/utils/format';

type PreferencesState = {
  theme: ThemePreference;
  units: UnitSystem;
  onboardingComplete: boolean;
  locationPromptSeen: boolean;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setUnits: (units: UnitSystem) => void;
  completeOnboarding: () => void;
  markLocationPromptSeen: () => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      units: 'metric',
      onboardingComplete: false,
      locationPromptSeen: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setUnits: (units) => set({ units }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      markLocationPromptSeen: () => set({ locationPromptSeen: true }),
    }),
    {
      name: 'aera.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        units: state.units,
        onboardingComplete: state.onboardingComplete,
        locationPromptSeen: state.locationPromptSeen,
      }),
    },
  ),
);
