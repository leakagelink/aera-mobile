import { Navigation } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  label: string;
  duration: string;
  detail: string;
  summary: string;
  active: boolean;
  onPress: () => void;
};

export function RouteCard({ label, duration, detail, summary, active, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: active ? theme.colors.primary : theme.colors.border,
          backgroundColor: active ? `${theme.colors.primary}1A` : theme.colors.card,
        },
      ]}
    >
      <View style={styles.header}>
        <AppText size={11} weight="bold" color={active ? theme.colors.primary : theme.colors.mutedForeground} style={styles.label}>
          {label}
        </AppText>
        {active ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
            <Navigation color={theme.colors.primaryForeground} size={12} fill={theme.colors.primaryForeground} />
          </View>
        ) : null}
      </View>
      <AppText size={28} weight="semibold" tabular style={styles.duration}>
        {duration}
      </AppText>
      <AppText size={14} color={theme.colors.mutedForeground}>
        {detail}
      </AppText>
      <AppText size={12} numberOfLines={2} style={styles.summary}>
        {summary}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 248,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { letterSpacing: 1.4, textTransform: 'uppercase' },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  duration: { marginTop: 12 },
  summary: { marginTop: 12 },
});
