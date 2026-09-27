import { ArrowUp, CornerUpLeft, CornerUpRight, MapPin, Undo2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = {
  instruction: string;
  distance: string;
  following?: string;
  modifier?: string;
  maneuverType?: string;
};

export function NavigationInstruction({ instruction, distance, following, modifier, maneuverType }: Props) {
  const theme = useTheme();
  const iconColor = theme.colors.primaryForeground;
  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primary }]}>
          <ManeuverIcon type={maneuverType} modifier={modifier} color={iconColor} />
        </View>
        <View style={styles.copy}>
          <AppText size={28} weight="semibold" tabular>
            {distance}
          </AppText>
          <AppText size={16} weight="medium" style={styles.instruction}>
            {instruction}
          </AppText>
          {following ? (
            <AppText size={12} color={theme.colors.mutedForeground} numberOfLines={1}>
              Then {following}
            </AppText>
          ) : null}
        </View>
      </View>
    </GlassCard>
  );
}

function ManeuverIcon({ type, modifier, color }: { type?: string; modifier?: string; color: string }) {
  if (type === 'arrive') return <MapPin color={color} size={32} strokeWidth={2.4} />;
  if (modifier?.includes('uturn')) return <Undo2 color={color} size={32} strokeWidth={2.4} />;
  if (modifier?.includes('left')) return <CornerUpLeft color={color} size={32} strokeWidth={2.4} />;
  if (modifier?.includes('right')) return <CornerUpRight color={color} size={32} strokeWidth={2.4} />;
  return <ArrowUp color={color} size={32} strokeWidth={2.4} />;
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  instruction: { marginTop: 2 },
});
