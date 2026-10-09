import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemePreference } from '@/theme';
import type { UnitSystem } from '@/utils/format';

export type AssistantLanguage = 'auto' | 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'bn' | 'gu' | 'kn' | 'ml' | 'pa' | 'ur';

export type SavedShortcut = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type PreferencesState = {
  theme: ThemePreference;
  units: UnitSystem;
  assistantLanguage: AssistantLanguage;
  home: SavedShortcut | null;
  work: SavedShortcut | null;
  onboardingComplete: boolean;
  locationPromptSeen: boolean;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setUnits: (units: UnitSystem) => void;
  setAssistantLanguage: (language: AssistantLanguage) => void;
  setHome: (place: SavedShortcut | null) => void;
  setWork: (place: SavedShortcut | null) => void;
  completeOnboarding: () => void;
  markLocationPromptSeen: () => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      units: 'metric',
      assistantLanguage: 'auto',
      home: null,
      work: null,
      onboardingComplete: false,
      locationPromptSeen: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setUnits: (units) => set({ units }),
      setAssistantLanguage: (assistantLanguage) => set({ assistantLanguage }),
      setHome: (home) => set({ home }),
      setWork: (work) => set({ work }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      markLocationPromptSeen: () => set({ locationPromptSeen: true }),
    }),
    {
      name: 'aera.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        units: state.units,
        assistantLanguage: state.assistantLanguage,
        home: state.home,
        work: state.work,
        onboardingComplete: state.onboardingComplete,
        locationPromptSeen: state.locationPromptSeen,
      }),
    },
  ),
);
