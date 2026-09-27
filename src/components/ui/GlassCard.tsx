import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

export function GlassCard({ children, style, padded = false }: Props) {
  const theme = useTheme();
  return (
    <BlurView
      intensity={theme.mode === 'dark' ? 42 : 64}
      tint={theme.mode === 'dark' ? 'dark' : 'light'}
      style={[styles.card, { borderColor: theme.colors.glassBorder, backgroundColor: theme.colors.glass }, padded && styles.padded, style]}
    >
      {children}
    </BlurView>
  );
}

export function FloatingCard({ children, style, padded = false }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        styles.float,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  float: {
    shadowColor: '#040810',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 10,
  },
  padded: {
    padding: 16,
  },
});
