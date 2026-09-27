import { Map, MessageCircle, Route, UserRound, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { AppText } from '@/components/ui/AppText';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const items: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'map', label: 'Map', icon: Map },
  { name: 'trips', label: 'Trips', icon: Route },
  { name: 'ai', label: 'AI', icon: MessageCircle },
  { name: 'profile', label: 'Profile', icon: UserRound },
];

export function BottomNavigation({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}>
        {state.routes.map((route, index) => {
          const item = items.find((entry) => entry.name === route.name);
          if (!item) return null;
          const active = state.index === index;
          const Icon = item.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={[styles.item, active && { backgroundColor: `${theme.colors.primary}1F` }]}
            >
              <Icon color={active ? theme.colors.primary : theme.colors.mutedForeground} size={20} strokeWidth={active ? 2.5 : 1.8} />
              <AppText size={10} weight="semibold" color={active ? theme.colors.primary : theme.colors.mutedForeground}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  bar: {
    height: 72,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  item: {
    minWidth: 64,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
