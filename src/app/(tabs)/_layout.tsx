import { Tabs } from 'expo-router';

import { BottomNavigation } from '@/components/ui/BottomNavigation';
import { useT } from '@/i18n';

export default function TabLayout() {
  const { t } = useT();
  return (
    <Tabs initialRouteName="map" tabBar={(props) => <BottomNavigation {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="map" options={{ title: t('nav.map') }} />
      <Tabs.Screen name="trips" options={{ title: t('nav.trips') }} />
      <Tabs.Screen name="ai" options={{ title: t('nav.talk') }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile') }} />
    </Tabs>
  );
}
