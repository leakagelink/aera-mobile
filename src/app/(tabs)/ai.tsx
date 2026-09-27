import { MessageCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/theme/useTheme';

export default function AiScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 120 }]}>
      <AppText size={34} weight="semibold">
        Talk to your map
      </AppText>
      <AppText size={15} color={theme.colors.mutedForeground} style={styles.copy}>
        Conversational guidance is a later Aera release. This version navigates, compares real routes, and records trips you start.
      </AppText>
      <GlassCard padded style={styles.card}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primary }]}>
          <MessageCircle color={theme.colors.primaryForeground} size={20} />
        </View>
        <AppText size={18} weight="semibold" style={styles.cardTitle}>
          Coming later
        </AppText>
        <AppText size={14} color={theme.colors.mutedForeground} style={styles.cardCopy}>
          There is no assistant connected yet, so Aera will not invent answers about traffic, voice, or your trips.
        </AppText>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  copy: { marginTop: 12, lineHeight: 22 },
  card: { marginTop: 28 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { marginTop: 16 },
  cardCopy: { marginTop: 8, lineHeight: 21 },
});
