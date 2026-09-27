export type PermissionState = 'undetermined' | 'granted' | 'denied';

export type AvailabilityState = 'unknown' | 'available' | 'unavailable';

export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export type Coordinate = {
  latitude: number;
  longitude: number;
};
