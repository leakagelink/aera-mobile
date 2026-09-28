import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { aeraApiRequest } from '@/services/api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerArahNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
  if (!Device.isDevice) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Arah',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const next = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (next.status !== 'granted') return false;
  const device = await Notifications.getDevicePushTokenAsync();
  const token = typeof device.data === 'string' ? device.data : '';
  if (token.length < 20) return false;
  await aeraApiRequest('/api/v1/notifications/device', {
    method: 'POST',
    body: { token, platform: Platform.OS },
  });
  return true;
}
