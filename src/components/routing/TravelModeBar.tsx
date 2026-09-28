import { Bike, Car, Footprints, Scooter } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useSessionStore } from '@/store/sessionStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';
import { TRAVEL_MODES } from '@/types/travel';

const icons = {
  walk: Footprints,
  bicycle: Bike,
  motorcycle: Scooter,
  car: Car,
} as const;

export function TravelModeBar() {
  const theme = useTheme();
  const mode = useSessionStore((state) => state.travelMode);
  const setTravelMode = useSessionStore((state) => state.setTravelMode);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {TRAVEL_MODES.map((item) => {
        const active = item.id === mode;
        const Icon = icons[item.id];
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setTravelMode(item.id)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
                borderColor: active ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Icon color={active ? theme.colors.primaryForeground : theme.colors.foreground} size={14} />
            <AppText size={12} weight="medium" color={active ? theme.colors.primaryForeground : theme.colors.foreground}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  chip: {
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
});
