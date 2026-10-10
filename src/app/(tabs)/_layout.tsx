import { Tabs } from 'expo-router';

import { BottomNavigation } from '@/components/ui/BottomNavigation';

export default function TabLayout() {
  return (
    <Tabs initialRouteName="map" tabBar={(props) => <BottomNavigation {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="trips" options={{ title: 'Safar' }} />
      <Tabs.Screen name="ai" options={{ title: 'Bolo' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
