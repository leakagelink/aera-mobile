import { useIsFocused, useRouter } from 'expo-router';
import { Coffee, LocateFixed, Plane, Trees } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AeraMap, type AeraMapHandle } from '@/components/map/AeraMap';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { LocationStatus } from '@/components/ui/LocationStatus';
import { SearchBar } from '@/components/ui/SearchBar';
import { useForegroundLocation } from '@/features/location/useForegroundLocation';
import { useLocationStore } from '@/store/locationStore';
import { radius } from '@/theme';
import { useTheme } from '@/theme/useTheme';

const suggestions = [
  { label: 'Coffee', query: 'coffee', icon: Coffee },
  { label: 'Parks', query: 'park', icon: Trees },
  { label: 'Airport', query: 'airport', icon: Plane },
];

export default function MapScreen() {
  const focused = useIsFocused();
  useForegroundLocation(focused, 'browse');
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AeraMapHandle>(null);
  const [follow, setFollow] = useState(true);
  const location = useLocationStore((state) => state.current);
  const permission = useLocationStore((state) => state.permission);
  const availability = useLocationStore((state) => state.availability);

  useEffect(() => {
    if (!follow || !location) return;
    mapRef.current?.recenter(location.longitude, location.latitude);
  }, [follow, location]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.ink }]}>
      <AeraMap
        ref={mapRef}
        user={location}
        onUserGesture={() => setFollow(false)}
      />
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <SearchBar editable={false} placeholder="Where do you want to go?" onPress={() => router.push('/search')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {suggestions.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.query}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/search', params: { q: item.query } })}
                style={[styles.chip, { backgroundColor: theme.colors.nav, borderColor: theme.colors.glassBorder }]}
              >
                <Icon color={theme.colors.foreground} size={14} />
                <AppText size={12} weight="medium">
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.actions}>
        <IconButton icon={LocateFixed} label="Recenter map" primary={follow} onPress={() => setFollow(true)} />
        <LocationStatus />
      </View>
      {permission !== 'granted' || availability === 'unavailable' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/permission')}
          style={[styles.banner, { bottom: insets.bottom + 96, backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <AppText size={14} weight="semibold">
            {permission === 'denied' ? 'Location is off' : 'Location is needed for navigation'}
          </AppText>
          <AppText size={12} color={theme.colors.mutedForeground}>
            Tap to review foreground location access.
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: 'absolute', left: 16, right: 16, gap: 12 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  actions: { position: 'absolute', right: 16, top: '38%', gap: 10, alignItems: 'flex-end' },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
});
