import { ChevronDown } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { usePrefersReducedMotion } from '@/theme/ReducedMotion';
import { useTheme } from '@/theme/useTheme';

type Props = {
  children: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

export function BottomSheet({ children, expanded, onExpandedChange }: Props) {
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: reduced ? 0 : 240 });
  }, [expanded, progress, reduced]);

  const gesture = Gesture.Pan().onEnd((event) => {
    if (event.translationY < -24) runOnJS(onExpandedChange)(true);
    if (event.translationY > 24) runOnJS(onExpandedChange)(false);
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <View style={[styles.sheet, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
      <GestureDetector gesture={gesture}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse trip details' : 'Expand trip details'}
          onPress={() => onExpandedChange(!expanded)}
          style={styles.handle}
        >
          <Animated.View style={chevronStyle}>
            <ChevronDown color={theme.colors.mutedForeground} size={20} />
          </Animated.View>
        </Pressable>
      </GestureDetector>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handle: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
