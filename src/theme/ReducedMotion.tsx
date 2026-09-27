import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

const ReducedMotionContext = createContext(false);

export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return <ReducedMotionContext.Provider value={reduced}>{children}</ReducedMotionContext.Provider>;
}

export function usePrefersReducedMotion(): boolean {
  return useContext(ReducedMotionContext);
}
