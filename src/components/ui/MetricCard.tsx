import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  label: string;
  value: string;
  unit?: string;
  compact?: boolean;
};

export function MetricCard({ label, value, unit, compact = false }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.card, compact ? styles.compact : styles.regular, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <AppText size={11} weight="medium" color={theme.colors.mutedForeground} style={styles.label}>
        {label}
      </AppText>
      <AppText size={compact ? 20 : 24} weight="semibold" tabular style={styles.value}>
        {value}
        {unit ? (
          <AppText size={12} weight="medium" color={theme.colors.mutedForeground}>
            {' '}
            {unit}
          </AppText>
        ) : null}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
  },
  compact: { padding: 12 },
  regular: { padding: 16 },
  label: { letterSpacing: 1.2, textTransform: 'uppercase' },
  value: { marginTop: 4 },
});
