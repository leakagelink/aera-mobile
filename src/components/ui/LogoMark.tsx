import { Navigation } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

export function LogoMark({ large = false }: { large?: boolean }) {
  const theme = useTheme();
  const size = large ? 80 : 44;
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: large ? 22 : 14, backgroundColor: theme.colors.primary }]}>
      <Navigation color={theme.colors.primaryForeground} size={large ? 36 : 20} fill={theme.colors.primaryForeground} />
      <View style={[styles.pip, { backgroundColor: theme.colors.success, borderColor: theme.colors.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  pip: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
