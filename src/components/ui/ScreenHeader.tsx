import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={[styles.back, { backgroundColor: theme.colors.secondary }]}>
          <ArrowLeft color={theme.colors.foreground} size={20} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <AppText size={18} weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText size={12} color={theme.colors.mutedForeground} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
});
