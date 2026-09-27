import * as Location from 'expo-location';

import { useLocationStore } from '@/store/locationStore';
import type { GeoLocation, PermissionState } from '@/types/location';

export type WatchMode = 'browse' | 'navigate';

const subscribers = new Map<number, WatchMode>();
let nextSubscriberId = 0;
let runId = 0;
let subscription: Location.LocationSubscription | null = null;
let activeMode: WatchMode | null = null;

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
      error: 'Location permission could not be read.',
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
    error: permission === 'denied' ? 'Location permission is off. Aera only uses it while the app is open.' : null,
  });
  if (permission === 'granted') void syncWatch();
  return permission;
}

export async function refreshLocationFix(): Promise<void> {
  const services = await Location.hasServicesEnabledAsync();
  if (!services) {
    useLocationStore.setState({
      availability: 'unavailable',
      error: 'Location services are turned off in system settings.',
    });
    return;
  }
  try {
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    publish(fix);
  } catch {
    useLocationStore.setState({
      availability: 'unavailable',
      error: 'A GPS fix is not available right now.',
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
  if (subscription && activeMode === mode) return;

  subscription?.remove();
  subscription = null;
  activeMode = mode;

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (run !== runId) return;
  if (!servicesEnabled) {
    useLocationStore.setState({
      availability: 'unavailable',
      watching: false,
      error: 'Location services are turned off in system settings.',
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
      error: 'A GPS fix is not available right now.',
    });
  }

  const options: Location.LocationOptions =
    mode === 'navigate'
      ? { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 4 }
      : { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 };

  const next = await Location.watchPositionAsync(options, publish, (message) => {
    useLocationStore.setState({
      availability: 'unavailable',
      error: message || 'Location is unavailable.',
    });
  });
  if (run !== runId) {
    next.remove();
    return;
  }
  subscription = next;
  useLocationStore.setState({ watching: true });
}

function stop(run: number): void {
  subscription?.remove();
  subscription = null;
  activeMode = null;
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
