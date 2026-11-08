import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { AppText } from '@/components/ui/AppText';
import { useLocationStore } from '@/store/locationStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  recording?: boolean;
};

export function LocationStatus({ recording = false }: Props) {
  const theme = useTheme();
  const { t } = useT();
  const permission = useLocationStore((state) => state.permission);
  const availability = useLocationStore((state) => state.availability);
  const accuracy = useLocationStore((state) => state.current?.accuracy ?? null);
  const watching = useLocationStore((state) => state.watching);

  let label = t('status.off');
  let color: string = theme.colors.mutedForeground;
  if (recording) {
    label = t('status.recording');
    color = theme.colors.error;
  } else if (permission === 'denied') {
    label = t('status.denied');
    color = theme.colors.error;
  } else if (availability === 'unavailable') {
    label = t('status.gps');
    color = theme.colors.warning;
  } else if (watching && accuracy === null) {
    label = t('status.searching');
    color = theme.colors.warning;
  } else if (permission === 'granted') {
    label = accuracy !== null && accuracy > 30 ? t('status.onAccurate', { meters: Math.round(accuracy) }) : t('status.on');
    color = theme.colors.success;
  }

  return (
    <View style={[styles.pill, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText size={12} weight="semibold">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
