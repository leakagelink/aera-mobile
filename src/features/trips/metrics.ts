import type { TripSample } from '@/types/trip';
import { distanceMeters } from '@/utils/geo';

const MAX_PLAUSIBLE_MPS = 55;
const MAX_ACCURACY_M = 80;

const MOVING_MPS = 0.8;

export type TripMetrics = {
  distanceMeters: number;
  durationSeconds: number;
  averageSpeedMps: number;
  maxSpeedMps: number;
  movingTimeSeconds: number;
  stoppedTimeSeconds: number;
  sampleCount: number;
};

export function computeTripMetrics(samples: TripSample[], startedAt: number, endedAt: number): TripMetrics {
  let distance = 0;
  let maxSpeed = 0;
  let movingTimeSeconds = 0;
  let stoppedTimeSeconds = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const next = samples[index];
    if (!previous || !next) continue;
    const dt = (next.timestamp - previous.timestamp) / 1000;
    if (dt <= 0) continue;
    const segment = distanceMeters(previous, next);
    const implied = segment / dt;
    const inaccurate =
      (previous.accuracy !== null && previous.accuracy > MAX_ACCURACY_M) ||
      (next.accuracy !== null && next.accuracy > MAX_ACCURACY_M);
    if (inaccurate || implied > MAX_PLAUSIBLE_MPS) continue;
    distance += segment;
    const moving = (next.speed !== null && next.speed >= MOVING_MPS) || (next.speed === null && implied >= MOVING_MPS);
    if (moving) movingTimeSeconds += dt;
    else stoppedTimeSeconds += dt;
    if (next.speed !== null && next.speed >= 0 && next.speed <= MAX_PLAUSIBLE_MPS) {
      maxSpeed = Math.max(maxSpeed, next.speed);
    }
  }

  const durationSeconds = Math.max(0, (endedAt - startedAt) / 1000);
  return {
    distanceMeters: distance,
    durationSeconds,
    averageSpeedMps: durationSeconds > 0 ? distance / durationSeconds : 0,
    maxSpeedMps: maxSpeed,
    movingTimeSeconds,
    stoppedTimeSeconds,
    sampleCount: samples.length,
  };
}
