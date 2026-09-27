import { z } from 'zod';

import { instructionFor } from '@/features/routing/instructions';
import { env } from '@/services/env';
import { requestJson } from '@/services/http';
import type { Coordinate } from '@/types/location';
import type { MatchedTrace, NearestRoad, RouteAlternative, RouteStep } from '@/types/route';
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

export async function fetchDrivingRoutes(
  origin: Coordinate,
  destination: Coordinate,
  signal?: AbortSignal,
): Promise<RouteAlternative[]> {
  if (!isValidCoordinate(origin.latitude, origin.longitude) || !isValidCoordinate(destination.latitude, destination.longitude)) {
    throw new AppError('Choose a valid destination.', 'invalid');
  }

  const path = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = new URL(`/route/v1/driving/${path}`, env.routingBaseUrl);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('annotations', 'distance,duration');

  const payload = await requestJson(url.toString(), {
    headers: { 'User-Agent': env.geocodingUserAgent },
    signal,
    timeoutMs: 15_000,
  });
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError('Routing returned an unexpected response.', 'osrm');
  }
  if (parsed.data.code !== 'Ok' || !parsed.data.routes?.length) {
    const unavailable = parsed.data.code === 'NoRoute' || parsed.data.code === 'NoSegment';
    throw new AppError(
      unavailable
        ? 'No driving route is available between these places.'
        : parsed.data.message || 'Routing failed. Try again.',
      'osrm',
    );
  }

  return parsed.data.routes.map((route, index) => toRoute(route, index));
}

function toRoute(route: z.infer<typeof routeSchema>, index: number): RouteAlternative {
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
    id: `osrm-${index}`,
    provider: 'osrm',
    label: index === 0 ? 'Recommended' : `Alternative ${index}`,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    summary: summary || steps.find((step) => step.name)?.name || 'Driving route',
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
