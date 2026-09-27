import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type SessionState = {
  token: string | null;
  email: string | null;
  hydrated: boolean;
  setSession: (token: string, email: string) => void;
  clearSession: () => void;
};

export const useAccountStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      hydrated: false,
      setSession: (token, email) => set({ token, email }),
      clearSession: () => set({ token: null, email: null }),
    }),
    {
      name: 'aera.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ token: state.token, email: state.email }),
    },
  ),
);
