import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radius } from '@/theme';
import { usePrefersReducedMotion } from '@/theme/ReducedMotion';
import { useTheme } from '@/theme/useTheme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ children, icon: Icon, disabled, onPress, style, ...props }: ButtonProps) {
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(event) => {
        if (!reduced) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.primary,
          opacity: disabled ? 0.45 : 1,
          transform: pressed && !disabled && !reduced ? [{ scale: 0.98 }] : undefined,
        },
        style,
      ]}
      {...props}
    >
      <View style={styles.row}>
        {Icon ? <Icon color={theme.colors.primaryForeground} size={20} /> : null}
        <AppText weight="semibold" size={16} color={theme.colors.primaryForeground}>
          {children}
        </AppText>
      </View>
    </Pressable>
  );
}

export function SecondaryButton({ children, icon: Icon, disabled, onPress, style, ...props }: ButtonProps) {
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(event) => {
        if (!reduced) void Haptics.selectionAsync();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          opacity: disabled ? 0.45 : 1,
          transform: pressed && !disabled && !reduced ? [{ scale: 0.98 }] : undefined,
        },
        style,
      ]}
      {...props}
    >
      <View style={styles.row}>
        {Icon ? <Icon color={theme.colors.foreground} size={20} /> : null}
        <AppText weight="semibold" size={16}>
          {children}
        </AppText>
      </View>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  primary = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.icon,
        {
          backgroundColor: primary ? theme.colors.primary : theme.colors.nav,
          borderColor: primary ? theme.colors.primary : theme.colors.glassBorder,
        },
      ]}
    >
      <Icon color={primary ? theme.colors.primaryForeground : theme.colors.foreground} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
