import type { Coordinate } from '@/types/location';
import type { RouteAlternative, RouteStep } from '@/types/route';
import { distanceMeters, progressAlongRoute, type RouteProgress } from '@/utils/geo';

export type NavigationSnapshot = RouteProgress & {
  remainingSeconds: number;
  eta: number;
  instruction: string;
  instructionDistanceMeters: number;
  followingInstruction?: string;
  maneuverType?: string;
  maneuverModifier?: string;
};

export function navigationSnapshot(
  location: Coordinate,
  speedMps: number | null,
  route: RouteAlternative,
  now = Date.now(),
): NavigationSnapshot {
  const progress = progressAlongRoute(location, route.geometry);
  const remainingSeconds = estimateRemainingSeconds(progress.remainingMeters, speedMps, route.distanceMeters, route.durationSeconds);
  const upcoming = upcomingStep(location, route.steps);
  return {
    ...progress,
    remainingSeconds,
    eta: now + remainingSeconds * 1000,
    instruction: upcoming?.step.instruction ?? 'Continue on the route',
    instructionDistanceMeters: upcoming?.distanceMeters ?? progress.remainingMeters,
    followingInstruction: upcoming?.following?.instruction,
    maneuverType: upcoming?.step.maneuverType,
    maneuverModifier: upcoming?.step.maneuverModifier,
  };
}

function estimateRemainingSeconds(
  remainingMeters: number,
  speedMps: number | null,
  plannedMeters: number,
  plannedSeconds: number,
): number {
  if (speedMps !== null && speedMps >= 1.5) return remainingMeters / speedMps;
  const pace = plannedMeters > 0 ? plannedSeconds / plannedMeters : 0.12;
  return remainingMeters * pace;
}

function upcomingStep(point: Coordinate, steps: RouteStep[]): { step: RouteStep; distanceMeters: number; following?: RouteStep } | null {
  if (steps.length === 0) return null;
  let closest = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  steps.forEach((step, index) => {
    const distance = distanceMeters(point, step.location);
    if (distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
  });
  const index = closestDistance < 40 && closest < steps.length - 1 ? closest + 1 : closest;
  const step = steps[index];
  if (!step) return null;
  return {
    step,
    distanceMeters: distanceMeters(point, step.location),
    following: steps[index + 1],
  };
}
