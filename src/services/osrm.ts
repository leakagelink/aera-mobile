import { z } from 'zod';

import { instructionFor } from '@/features/routing/instructions';
import { env } from '@/services/env';
import { requestJson } from '@/services/http';
import type { Coordinate } from '@/types/location';
import type { MatchedTrace, NearestRoad, RouteAlternative, RouteLimits, RouteStep } from '@/types/route';
import { travelModeLabel, type OsrmProfile, type TravelMode } from '@/types/travel';
import { AppError } from '@/utils/errors';
import { isValidCoordinate } from '@/utils/geo';

const stepSchema = z.object({
  distance: z.number(),
  duration: z.number(),
  name: z.string().optional(),
  maneuver: z.object({
    type: z.string(),
    modifier: z.string().optional(),
    location: z.tuple([z.number(), z.number()]),
  }),
});

const routeSchema = z.object({
  distance: z.number(),
  duration: z.number(),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number(), z.number()])),
  }),
  legs: z.array(
    z.object({
      summary: z.string().optional(),
      steps: z.array(stepSchema).optional(),
      annotation: z
        .object({
          distance: z.array(z.number()).optional(),
          duration: z.array(z.number()).optional(),
        })
        .optional(),
    }),
  ),
});

const responseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  routes: z.array(routeSchema).optional(),
});

export async function fetchRoutes(
  origin: Coordinate,
  destination: Coordinate,
  profile: OsrmProfile,
  mode: TravelMode,
  signal?: AbortSignal,
  limits?: RouteLimits,
): Promise<RouteAlternative[]> {
  if (!isValidCoordinate(origin.latitude, origin.longitude) || !isValidCoordinate(destination.latitude, destination.longitude)) {
    throw new AppError('Choose a valid destination.', 'invalid');
  }

  const exclude = excludeClasses(limits);
  const first = await requestRoute(origin, destination, profile, signal, exclude);
  if (exclude && isUnsupportedExclude(first)) {
    const plain = await requestRoute(origin, destination, profile, signal);
    return routesFrom(plain, mode, unsupportedLimitNote(limits), false);
  }
  return routesFrom(first, mode, exclude ? appliedLimitNote(limits) : null, Boolean(exclude));
}

function excludeClasses(limits?: RouteLimits): string {
  const parts: string[] = [];
  if (limits?.avoidTolls) parts.push('toll');
  if (limits?.avoidHighways) parts.push('motorway');
  return parts.join(',');
}

function unsupportedLimitNote(limits?: RouteLimits): string {
  if (limits?.avoidTolls && limits?.avoidHighways) {
    return 'Toll aur highway filter nahi laga. Ye routing server unhe hata kar rasta nahi nikalta. Dikha hua rasta normal hai.';
  }
  if (limits?.avoidTolls) {
    return 'Toll filter nahi laga. Ye routing server toll hata kar rasta nahi nikalta. Dikha hua rasta normal hai.';
  }
  return 'Highway filter nahi laga. Ye routing server highway hata kar rasta nahi nikalta. Dikha hua rasta normal hai.';
}

function appliedLimitNote(limits?: RouteLimits): string {
  if (limits?.avoidTolls && limits?.avoidHighways) return 'Ye rasta toll aur highway ke bina hai.';
  if (limits?.avoidTolls) return 'Ye rasta toll ke bina hai.';
  return 'Ye rasta highway ke bina hai.';
}

function isUnsupportedExclude(payload: OsrmRoutePayload | { unsupported: true }): payload is { unsupported: true } {
  return 'unsupported' in payload;
}

type OsrmRoutePayload = z.infer<typeof responseSchema>;

async function requestRoute(
  origin: Coordinate,
  destination: Coordinate,
  profile: OsrmProfile,
  signal?: AbortSignal,
  exclude?: string,
): Promise<OsrmRoutePayload | { unsupported: true }> {
  const path = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = new URL(`/route/v1/${profile}/${path}`, env.routingBaseUrl);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('annotations', 'distance,duration');
  if (exclude) url.searchParams.set('exclude', exclude);

  try {
    const payload = await requestJson(url.toString(), {
      headers: { 'User-Agent': env.geocodingUserAgent },
      signal,
      timeoutMs: 15_000,
    });
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) throw new AppError('Routing returned an unexpected response.', 'osrm');
    if (exclude && parsed.data.code === 'InvalidOptions') return { unsupported: true };
    return parsed.data;
  } catch (error) {
    if (exclude && error instanceof AppError && /exclude|not supported|invalidoptions|request failed \(400\)/i.test(error.message)) {
      return { unsupported: true };
    }
    throw error;
  }
}

function routesFrom(
  payload: OsrmRoutePayload | { unsupported: true },
  mode: TravelMode,
  limitNote: string | null,
  filtered: boolean,
): RouteAlternative[] {
  if ('unsupported' in payload || payload.code !== 'Ok' || !payload.routes?.length) {
    const code = 'unsupported' in payload ? '' : payload.code;
    const message = 'unsupported' in payload ? '' : payload.message;
    const unavailable = code === 'NoRoute' || code === 'NoSegment';
    throw new AppError(
      unavailable
        ? filtered
          ? 'Toll ya highway ke bina koi rasta nahi mila.'
          : `No ${travelModeLabel(mode).toLowerCase()} route is available between these places.`
        : message || 'Routing failed. Try again.',
      'osrm',
    );
  }
  return payload.routes.map((route, index) => ({ ...toRoute(route, index, mode), limitNote }));
}

function toRoute(route: z.infer<typeof routeSchema>, index: number, mode: TravelMode): RouteAlternative {
  const steps = route.legs.flatMap((leg) => (leg.steps ?? []).map(toStep));
  const summary = route.legs.map((leg) => leg.summary?.trim()).filter((value): value is string => Boolean(value)).join(' · ');
  const geometry = route.geometry.coordinates.flatMap(([longitude, latitude]) =>
    isValidCoordinate(latitude, longitude) ? [{ latitude, longitude }] : [],
  );
  if (geometry.length < 2) {
    throw new AppError('The route geometry was incomplete.', 'osrm');
  }
  const distances = route.legs.flatMap((leg) => leg.annotation?.distance ?? []);
  const durations = route.legs.flatMap((leg) => leg.annotation?.duration ?? []);
  return {
    id: `osrm-${mode}-${index}`,
    provider: 'osrm',
    label: index === 0 ? 'Ye rasta' : `Doosra ${index}`,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    summary: summary || steps.find((step) => step.name)?.name || `${travelModeLabel(mode)} ka rasta`,
    geometry,
    steps,
    annotations:
      distances.length > 0 && durations.length === distances.length
        ? { segmentDistancesMeters: distances, segmentDurationsSeconds: durations }
        : undefined,
  };
}

const nearestSchema = z.object({
  code: z.string(),
  waypoints: z
    .array(
      z.object({
        location: z.tuple([z.number(), z.number()]),
        distance: z.number().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
});

const matchSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  matchings: z
    .array(
      z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({
          type: z.literal('LineString'),
          coordinates: z.array(z.tuple([z.number(), z.number()])),
        }),
      }),
    )
    .optional(),
});

const MATCH_POINT_LIMIT = 100;

export async function nearestRoad(coordinate: Coordinate, signal?: AbortSignal): Promise<NearestRoad | null> {
  if (!isValidCoordinate(coordinate.latitude, coordinate.longitude)) {
    throw new AppError('That location is not valid.', 'invalid');
  }
  const url = new URL(`/nearest/v1/driving/${coordinate.longitude},${coordinate.latitude}`, env.routingBaseUrl);
  const payload = await requestJson(url.toString(), {
    headers: { 'User-Agent': env.geocodingUserAgent },
    signal,
    timeoutMs: 12_000,
  });
  const parsed = nearestSchema.safeParse(payload);
  if (!parsed.success || parsed.data.code !== 'Ok') return null;
  const waypoint = parsed.data.waypoints?.[0];
  if (!waypoint) return null;
  const [longitude, latitude] = waypoint.location;
  if (!isValidCoordinate(latitude, longitude)) return null;
  return {
    location: { latitude, longitude },
    distanceMeters: waypoint.distance ?? 0,
    name: waypoint.name || undefined,
  };
}

export async function matchTrace(trace: Coordinate[], signal?: AbortSignal): Promise<MatchedTrace | null> {
  const valid = trace.filter((point) => isValidCoordinate(point.latitude, point.longitude));
  if (valid.length < 2) {
    throw new AppError('Map matching needs at least two locations.', 'invalid');
  }
  const simplified = valid.length > MATCH_POINT_LIMIT;
  const points = simplified ? thinTrace(valid, MATCH_POINT_LIMIT) : valid;
  const path = points.map((point) => `${point.longitude},${point.latitude}`).join(';');
  const url = new URL(`/match/v1/driving/${path}`, env.routingBaseUrl);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  const payload = await requestJson(url.toString(), {
    headers: { 'User-Agent': env.geocodingUserAgent },
    signal,
    timeoutMs: 15_000,
  });
  const parsed = matchSchema.safeParse(payload);
  if (!parsed.success || parsed.data.code !== 'Ok' || !parsed.data.matchings?.[0]) return null;
  const matching = parsed.data.matchings[0];
  const geometry = matching.geometry.coordinates.flatMap(([longitude, latitude]) =>
    isValidCoordinate(latitude, longitude) ? [{ latitude, longitude }] : [],
  );
  if (geometry.length < 2) return null;
  return {
    geometry,
    distanceMeters: matching.distance,
    durationSeconds: matching.duration,
    traceSimplified: simplified,
  };
}

function thinTrace(points: Coordinate[], limit: number): Coordinate[] {
  if (points.length <= limit) return points;
  const last = points.length - 1;
  const selected: Coordinate[] = [];
  for (let index = 0; index < limit; index += 1) {
    const source = Math.round((index * last) / (limit - 1));
    const point = points[source];
    if (point) selected.push(point);
  }
  return selected;
}

function toStep(step: z.infer<typeof stepSchema>): RouteStep {
  const [longitude, latitude] = step.maneuver.location;
  return {
    instruction: instructionFor(step.maneuver.type, step.maneuver.modifier, step.name),
    distanceMeters: step.distance,
    durationSeconds: step.duration,
    maneuverType: step.maneuver.type,
    maneuverModifier: step.maneuver.modifier,
    name: step.name || undefined,
    location: { latitude, longitude },
  };
}
