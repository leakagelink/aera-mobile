import { z } from 'zod';

import { instructionFor } from '@/features/routing/instructions';
import { env } from '@/services/env';
import { requestJson } from '@/services/http';
import type { Coordinate } from '@/types/location';
import type { RouteAlternative, RouteStep } from '@/types/route';
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
  const url = new URL(`/route/v1/driving/${path}`, env.osrmBaseUrl);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('alternatives', 'true');

  const payload = await requestJson(url.toString(), {
    headers: { 'User-Agent': env.nominatimUserAgent },
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
  return {
    id: `osrm-${index}`,
    label: index === 0 ? 'Recommended' : `Alternative ${index}`,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    summary: summary || steps.find((step) => step.name)?.name || 'Driving route',
    geometry,
    steps,
  };
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
