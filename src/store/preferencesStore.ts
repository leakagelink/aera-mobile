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
  favorites: SavedShortcut[];
  rememberChats: boolean;
  onboardingComplete: boolean;
  locationPromptSeen: boolean;
  hydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  setUnits: (units: UnitSystem) => void;
  setAssistantLanguage: (language: AssistantLanguage) => void;
  setHome: (place: SavedShortcut | null) => void;
  setWork: (place: SavedShortcut | null) => void;
  addFavorite: (place: SavedShortcut) => void;
  removeFavorite: (place: SavedShortcut) => void;
  setRememberChats: (remember: boolean) => void;
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
      favorites: [],
      rememberChats: false,
      onboardingComplete: false,
      locationPromptSeen: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setUnits: (units) => set({ units }),
      setAssistantLanguage: (assistantLanguage) => set({ assistantLanguage }),
      setHome: (home) => set({ home }),
      setWork: (work) => set({ work }),
      addFavorite: (place) =>
        set((state) => {
          const duplicate = state.favorites.some((item) => Math.abs(item.latitude - place.latitude) < 0.0001 && Math.abs(item.longitude - place.longitude) < 0.0001);
          if (duplicate) return state;
          return { favorites: [place, ...state.favorites].slice(0, 20) };
        }),
      removeFavorite: (place) =>
        set((state) => ({
          favorites: state.favorites.filter((item) => Math.abs(item.latitude - place.latitude) >= 0.0001 || Math.abs(item.longitude - place.longitude) >= 0.0001),
        })),
      setRememberChats: (rememberChats) => set({ rememberChats }),
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
        favorites: state.favorites,
        rememberChats: state.rememberChats,
        onboardingComplete: state.onboardingComplete,
        locationPromptSeen: state.locationPromptSeen,
      }),
    },
  ),
);
