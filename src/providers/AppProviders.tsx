import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { readExistingPermission } from '@/features/location/locationEngine';
import { queryClient } from '@/services/queryClient';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTripStore } from '@/store/tripStore';
import { ReducedMotionProvider } from '@/theme/ReducedMotion';

export function AppProviders({ children }: { children: ReactNode }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void useTripStore.getState().hydrate();
    void readExistingPermission();
    const finish = () => usePreferencesStore.setState({ hydrated: true });
    const unsubscribe = usePreferencesStore.persist.onFinishHydration(finish);
    if (usePreferencesStore.persist.hasHydrated()) finish();
    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ReducedMotionProvider>
          <AppErrorBoundary>{children}</AppErrorBoundary>
        </ReducedMotionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
