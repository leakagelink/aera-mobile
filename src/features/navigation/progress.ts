import { t } from '@/i18n';
import { instructionFor } from '@/features/routing/instructions';
import { roadNameAtDistance } from '@/features/routing/segments';
import type { Coordinate } from '@/types/location';
import type { RouteAlternative, RouteStep } from '@/types/route';
import { distanceMeters, matchToRoute, type RouteMatch, type RouteMatchHint } from '@/utils/geo';

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
  const upcoming = upcomingStep(match.traveledMeters, route.steps, route.geometry);
  const roadName = upcoming?.step.name || roadNameAtDistance(route.steps, match.traveledMeters);
  return {
    ...match,
    match,
    remainingSeconds,
    eta: now + remainingSeconds * 1000,
    instruction: match.offRoute ? t('navi.offRoute') : upcoming ? phraseFor(upcoming.step, upcoming.distanceMeters) : t('navi.straight'),
    instructionDistanceMeters: match.offRoute ? match.crossTrackMeters : (upcoming?.distanceMeters ?? match.remainingMeters),
    followingInstruction: match.offRoute || !upcoming?.following ? undefined : phraseFor(upcoming.following, upcoming.followingDistanceMeters ?? 0),
    maneuverType: match.offRoute ? undefined : upcoming?.step.maneuverType,
    maneuverModifier: match.offRoute ? undefined : upcoming?.step.maneuverModifier,
    roadName,
  };
}

function phraseFor(step: RouteStep, distanceMeters: number): string {
  if (step.maneuverType === 'arrive' && distanceMeters > 40) {
    return step.name ? t('turn.straightRoad', { road: step.name }) : t('navi.straight');
  }
  return instructionFor(step.maneuverType, step.maneuverModifier, step.name);
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

function upcomingStep(
  traveledMeters: number,
  steps: RouteStep[],
  geometry: Coordinate[],
): { step: RouteStep; distanceMeters: number; following?: RouteStep; followingDistanceMeters?: number } | null {
  if (steps.length === 0) return null;
  let cursor = 0;
  const placed = steps.map((step) => {
    const at = cursor;
    cursor += Math.max(0, step.distanceMeters);
    const maneuverModifier = modifierFromRoad(geometry, at, step);
    return { step: { ...step, maneuverModifier }, at };
  });
  let index = placed.findIndex((item) => item.at >= traveledMeters - 12);
  if (index < 0) index = placed.length - 1;
  while (index < placed.length - 1 && !isActionable(placed[index]?.step)) index += 1;
  const chosen = placed[index];
  if (!chosen) return null;
  let followIndex = index + 1;
  while (followIndex < placed.length - 1 && !isActionable(placed[followIndex]?.step)) followIndex += 1;
  const following = placed[followIndex];
  return {
    step: chosen.step,
    distanceMeters: Math.max(0, chosen.at - traveledMeters),
    following: following && followIndex > index ? following.step : undefined,
    followingDistanceMeters: following && followIndex > index ? Math.max(0, following.at - traveledMeters) : undefined,
  };
}

function isActionable(step: RouteStep | undefined): boolean {
  if (!step) return false;
  if (step.maneuverType === 'arrive') return true;
  if (step.maneuverType === 'depart' || step.maneuverType === 'continue' || step.maneuverType === 'new name') return false;
  const modifier = step.maneuverModifier ?? '';
  return modifier !== 'straight' && modifier !== 'ahead';
}

function modifierFromRoad(geometry: Coordinate[], at: number, step: RouteStep): string | undefined {
  const type = step.maneuverType;
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn' || type === 'exit roundabout' || type === 'exit rotary') {
    return step.maneuverModifier;
  }
  const before = pointAlong(geometry, Math.max(0, at - 28));
  const corner = pointAlong(geometry, at);
  const after = pointAlong(geometry, at + 28);
  if (!before || !corner || !after) return step.maneuverModifier;
  if (distanceMeters(before, corner) < 12 || distanceMeters(corner, after) < 12) return step.maneuverModifier;
  let delta = bearingDegrees(corner, after) - bearingDegrees(before, corner);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const amount = Math.abs(delta);
  if (amount < 22) return 'straight';
  const side = delta > 0 ? 'right' : 'left';
  if (amount < 50) return `slight ${side}`;
  if (amount < 140) return side;
  if (amount < 165) return `sharp ${side}`;
  return 'uturn';
}

function pointAlong(geometry: Coordinate[], meters: number): Coordinate | null {
  if (geometry.length === 0) return null;
  if (meters <= 0) return geometry[0] ?? null;
  let walked = 0;
  for (let index = 1; index < geometry.length; index += 1) {
    const start = geometry[index - 1];
    const end = geometry[index];
    if (!start || !end) continue;
    const length = distanceMeters(start, end);
    if (walked + length >= meters) {
      const ratio = length === 0 ? 0 : (meters - walked) / length;
      return {
        latitude: start.latitude + (end.latitude - start.latitude) * ratio,
        longitude: start.longitude + (end.longitude - start.longitude) * ratio,
      };
    }
    walked += length;
  }
  return geometry[geometry.length - 1] ?? null;
}

function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}
