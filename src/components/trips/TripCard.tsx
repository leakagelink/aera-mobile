import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  detail: string;
  onPress: () => void;
  onSelect?: () => void;
  selected?: boolean;
};

export function TripCard({ title, detail, onPress, onSelect, selected = false }: Props) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.swatch, { backgroundColor: theme.colors.ink }]}>
        <View style={[styles.line, { backgroundColor: theme.colors.primary }]} />
      </View>
      <View style={styles.copy}>
        <AppText size={14} weight="semibold" numberOfLines={1}>
          {title}
        </AppText>
        <AppText size={12} color={theme.colors.mutedForeground} numberOfLines={1} style={styles.detail}>
          {detail}
        </AppText>
      </View>
      {onSelect ? (
        <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onSelect} hitSlop={8}>
          <AppText size={12} weight="semibold" color={selected ? theme.colors.primary : theme.colors.mutedForeground}>
            {selected ? 'Selected' : 'Select'}
          </AppText>
        </Pressable>
      ) : null}
      <ChevronRight color={theme.colors.mutedForeground} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
  },
  swatch: {
    width: 56,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 36, height: 3, borderRadius: 2, transform: [{ rotate: '24deg' }] },
  copy: { flex: 1 },
  detail: { marginTop: 4 },
});
