import { distanceMeters, type Coordinate } from '../../common/geo';

const MAX_PLAUSIBLE_MPS = 55;
const MAX_ACCURACY_M = 80;
const MOVING_MPS = 0.8;

export type MetricSample = Coordinate & {
  recordedAt: string;
  accuracy: number | null;
  speed: number | null;
};

export type TripMetrics = {
  distanceMeters: number;
  durationSeconds: number;
  movingSeconds: number;
  stoppedSeconds: number;
  averageSpeedMps: number;
  maxSpeedMps: number;
};

export function computeTripMetrics(samples: MetricSample[], startedAt: string, endedAt: string): TripMetrics {
  let distance = 0;
  let maxSpeed = 0;
  let movingSeconds = 0;
  let stoppedSeconds = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const next = samples[index];
    if (!previous || !next) continue;
    const dt = (Date.parse(next.recordedAt) - Date.parse(previous.recordedAt)) / 1000;
    if (dt <= 0) continue;
    const segment = distanceMeters(previous, next);
    const implied = segment / dt;
    const inaccurate = (previous.accuracy !== null && previous.accuracy > MAX_ACCURACY_M) || (next.accuracy !== null && next.accuracy > MAX_ACCURACY_M);
    if (inaccurate || implied > MAX_PLAUSIBLE_MPS) continue;
    distance += segment;
    const moving = (next.speed !== null && next.speed >= MOVING_MPS) || (next.speed === null && implied >= MOVING_MPS);
    if (moving) movingSeconds += dt;
    else stoppedSeconds += dt;
    if (next.speed !== null && next.speed >= 0 && next.speed <= MAX_PLAUSIBLE_MPS) maxSpeed = Math.max(maxSpeed, next.speed);
  }
  const durationSeconds = Math.max(0, (Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
  return {
    distanceMeters: distance,
    durationSeconds,
    movingSeconds,
    stoppedSeconds,
    averageSpeedMps: durationSeconds > 0 ? distance / durationSeconds : 0,
    maxSpeedMps: maxSpeed,
  };
}
