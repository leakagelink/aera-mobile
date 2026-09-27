import type { Coordinate } from '@/types/location';
import type { TripSample } from '@/types/trip';
import { distanceMeters } from '@/utils/geo';

export type ReplayFrame = {
  timestamp: number;
  coordinate: Coordinate;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  traveledMeters: number;
  fraction: number;
};

export type ReplayCamera = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: 0;
};

export function buildReplay(samples: TripSample[]): ReplayFrame[] {
  if (samples.length === 0) return [];
  const distances = [0];
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const next = samples[index];
    const step = previous && next ? distanceMeters(previous, next) : 0;
    distances.push((distances[index - 1] ?? 0) + step);
  }
  const total = distances[distances.length - 1] ?? 0;
  return samples.map((sample, index) => {
    const traveled = distances[index] ?? 0;
    return {
      timestamp: sample.timestamp,
      coordinate: { latitude: sample.latitude, longitude: sample.longitude },
      altitude: sample.altitude,
      speed: sample.speed,
      heading: sample.heading ?? bearingBetween(samples[index - 1], sample),
      accuracy: sample.accuracy,
      traveledMeters: traveled,
      fraction: total > 0 ? traveled / total : 0,
    };
  });
}

export function frameAt(frames: ReplayFrame[], timestamp: number): ReplayFrame | null {
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (!first || !last) return null;
  if (timestamp <= first.timestamp) return first;
  if (timestamp >= last.timestamp) return last;
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const next = frames[index];
    if (!previous || !next || timestamp > next.timestamp) continue;
    const span = next.timestamp - previous.timestamp;
    const t = span <= 0 ? 0 : (timestamp - previous.timestamp) / span;
    return {
      timestamp,
      coordinate: lerp(previous.coordinate, next.coordinate, t),
      altitude: lerpNullable(previous.altitude, next.altitude, t),
      speed: lerpNullable(previous.speed, next.speed, t),
      heading: next.heading ?? previous.heading,
      accuracy: Math.max(previous.accuracy ?? 0, next.accuracy ?? 0) || null,
      traveledMeters: previous.traveledMeters + (next.traveledMeters - previous.traveledMeters) * t,
      fraction: previous.fraction + (next.fraction - previous.fraction) * t,
    };
  }
  return last;
}

export function replayCamera(samples: TripSample[], fraction: number): ReplayCamera | null {
  const frames = buildReplay(samples);
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (!first || !last) return null;
  const targetTime = first.timestamp + (last.timestamp - first.timestamp) * clamp01(fraction);
  const frame = frameAt(frames, targetTime);
  if (!frame) return null;
  return {
    center: [frame.coordinate.longitude, frame.coordinate.latitude],
    zoom: 16,
    bearing: frame.heading ?? 0,
    pitch: 0,
  };
}

function bearingBetween(from: TripSample | undefined, to: TripSample): number | null {
  if (!from) return null;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  if (x === 0 && y === 0) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function lerp(a: Coordinate, b: Coordinate, t: number): Coordinate {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function lerpNullable(a: number | null, b: number | null, t: number): number | null {
  if (a === null || b === null) return b ?? a;
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
