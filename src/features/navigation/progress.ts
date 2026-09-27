import { roadNameAtDistance } from '@/features/routing/segments';
import type { Coordinate } from '@/types/location';
import type { RouteAlternative, RouteStep } from '@/types/route';
import { matchToRoute, type RouteMatch, type RouteMatchHint } from '@/utils/geo';

export type NavigationSnapshot = RouteMatch & {
  remainingSeconds: number;
  eta: number;
  instruction: string;
  instructionDistanceMeters: number;
  followingInstruction?: string;
  maneuverType?: string;
  maneuverModifier?: string;
  roadName?: string;
  match: RouteMatch;
};

let remembered: { routeId: string; hint: RouteMatchHint } | null = null;

export function navigationSnapshot(
  location: Coordinate,
  speedMps: number | null,
  route: RouteAlternative,
  now = Date.now(),
  hint?: RouteMatchHint | null,
): NavigationSnapshot {
  const previous = hint ?? (remembered?.routeId === route.id ? remembered.hint : null);
  const match = matchToRoute(location, route.geometry, previous);
  remembered = {
    routeId: route.id,
    hint: { segmentIndex: match.segmentIndex, traveledMeters: match.traveledMeters },
  };
  const remainingSeconds = estimateRemainingSeconds(match.remainingMeters, speedMps, route.distanceMeters, route.durationSeconds);
  const upcoming = upcomingStep(match.traveledMeters, route.steps);
  const roadName = roadNameAtDistance(route.steps, match.traveledMeters);
  return {
    ...match,
    match,
    remainingSeconds,
    eta: now + remainingSeconds * 1000,
    instruction: match.offRoute ? 'Off the planned route' : (upcoming?.step.instruction ?? 'Continue on the route'),
    instructionDistanceMeters: match.offRoute ? match.crossTrackMeters : (upcoming?.distanceMeters ?? match.remainingMeters),
    followingInstruction: match.offRoute ? undefined : upcoming?.following?.instruction,
    maneuverType: match.offRoute ? undefined : upcoming?.step.maneuverType,
    maneuverModifier: match.offRoute ? undefined : upcoming?.step.maneuverModifier,
    roadName,
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

function upcomingStep(traveledMeters: number, steps: RouteStep[]): { step: RouteStep; distanceMeters: number; following?: RouteStep } | null {
  if (steps.length === 0) return null;
  let cursor = 0;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step) continue;
    const end = cursor + Math.max(0, step.distanceMeters);
    if (traveledMeters < end - 15 || index === steps.length - 1) {
      return {
        step,
        distanceMeters: Math.max(0, end - traveledMeters),
        following: steps[index + 1],
      };
    }
    cursor = end;
  }
  return null;
}
