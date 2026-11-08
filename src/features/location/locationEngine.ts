import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { t } from '@/i18n';
import { useLocationStore } from '@/store/locationStore';
import type { GeoLocation, PermissionState } from '@/types/location';

export type WatchMode = 'browse' | 'navigate';

export const NAVIGATION_TASK = 'arah-navigation-location';

type LocationTaskData = { locations?: Location.LocationObject[] };

TaskManager.defineTask<LocationTaskData>(NAVIGATION_TASK, async ({ data, error }) => {
  if (error) {
    useLocationStore.setState({ availability: 'unavailable', error: 'location.unavailable' });
    return;
  }
  const fix = data?.locations?.[data.locations.length - 1];
  if (fix) publish(fix);
});

const subscribers = new Map<number, WatchMode>();
let nextSubscriberId = 0;
let runId = 0;
let subscription: Location.LocationSubscription | null = null;
let activeMode: WatchMode | null = null;
let navigationStarted = false;

export function acquireLocation(mode: WatchMode): () => void {
  const id = ++nextSubscriberId;
  subscribers.set(id, mode);
  void syncWatch();
  return () => {
    subscribers.delete(id);
    void syncWatch();
  };
}

export async function readExistingPermission(): Promise<void> {
  try {
    const result = await Location.getForegroundPermissionsAsync();
    useLocationStore.setState({
      permission: toPermission(result.status),
      canAskAgain: result.canAskAgain,
      permissionKnown: true,
    });
  } catch {
    useLocationStore.setState({
      permissionKnown: true,
      availability: 'unavailable',
      error: 'location.permissionUnread',
    });
  }
}

export async function requestForegroundPermission(): Promise<PermissionState> {
  const result = await Location.requestForegroundPermissionsAsync();
  const permission = toPermission(result.status);
  useLocationStore.setState({
    permission,
    canAskAgain: result.canAskAgain,
    permissionKnown: true,
      error: permission === 'denied' ? 'location.denied' : null,
  });
  if (permission === 'granted') void syncWatch();
  return permission;
}

export async function refreshLocationFix(): Promise<void> {
  const services = await Location.hasServicesEnabledAsync();
  if (!services) {
    useLocationStore.setState({
      availability: 'unavailable',
      error: 'location.servicesOff',
    });
    return;
  }
  try {
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    publish(fix);
  } catch {
    useLocationStore.setState({
      availability: 'unavailable',
      error: 'location.noFix',
    });
  }
}

async function syncWatch(): Promise<void> {
  const run = ++runId;
  const modes = [...subscribers.values()];
  if (modes.length === 0) {
    stop(run);
    return;
  }

  const mode: WatchMode = modes.includes('navigate') ? 'navigate' : 'browse';
  if (activeMode === mode && (mode === 'navigate' ? navigationStarted : subscription)) return;

  subscription?.remove();
  subscription = null;
  if (mode !== 'navigate') await stopNavigationTask();
  activeMode = mode;

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (run !== runId) return;
  if (!servicesEnabled) {
    useLocationStore.setState({
      availability: 'unavailable',
      watching: false,
      error: 'location.servicesOff',
    });
    return;
  }

  const permission = await Location.getForegroundPermissionsAsync();
  if (run !== runId) return;
  useLocationStore.setState({
    permission: toPermission(permission.status),
    canAskAgain: permission.canAskAgain,
  });
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    useLocationStore.setState({ watching: false });
    return;
  }

  useLocationStore.setState({ watching: true, error: null });
  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: mode === 'navigate' ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
    });
    if (run !== runId) return;
    publish(current);
  } catch {
    if (run !== runId) return;
    useLocationStore.setState({
      availability: 'unavailable',
      error: 'location.noFix',
    });
  }

  if (mode === 'navigate') {
    try {
      await startNavigationTask();
    } catch {
      if (run === runId) {
        useLocationStore.setState({ availability: 'unavailable', error: 'location.unavailable' });
      }
      return;
    }
    if (run !== runId) {
      await stopNavigationTask();
      return;
    }
    useLocationStore.setState({ watching: true });
    return;
  }

  const next = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
    publish,
    () => {
      useLocationStore.setState({
        availability: 'unavailable',
        error: 'location.unavailable',
      });
    },
  );
  if (run !== runId) {
    next.remove();
    return;
  }
  subscription = next;
  useLocationStore.setState({ watching: true });
}

async function startNavigationTask(): Promise<void> {
  await Notifications.requestPermissionsAsync().catch(() => undefined);
  const running = await Location.hasStartedLocationUpdatesAsync(NAVIGATION_TASK).catch(() => false);
  if (!running) {
    await Location.startLocationUpdatesAsync(NAVIGATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 4,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: t('guide.title'),
        notificationBody: t('guide.body'),
        notificationColor: '#1496E0',
        killServiceOnDestroy: true,
      },
    });
  }
  navigationStarted = true;
}

async function stopNavigationTask(): Promise<void> {
  navigationStarted = false;
  const running = await Location.hasStartedLocationUpdatesAsync(NAVIGATION_TASK).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(NAVIGATION_TASK);
}

function stop(run: number): void {
  subscription?.remove();
  subscription = null;
  activeMode = null;
  void stopNavigationTask();
  if (run === runId) useLocationStore.setState({ watching: false });
}

function publish(fix: Location.LocationObject): void {
  const location: GeoLocation = {
    latitude: fix.coords.latitude,
    longitude: fix.coords.longitude,
    accuracy: finiteOrNull(fix.coords.accuracy),
    altitude: finiteOrNull(fix.coords.altitude),
    heading: fix.coords.heading === null || fix.coords.heading < 0 ? null : fix.coords.heading,
    speed: fix.coords.speed === null || fix.coords.speed < 0 ? null : fix.coords.speed,
    timestamp: fix.timestamp,
  };
  useLocationStore.getState().setCurrent(location);
}

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function toPermission(status: Location.PermissionStatus): PermissionState {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}
