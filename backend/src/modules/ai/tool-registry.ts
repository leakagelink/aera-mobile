import { Injectable } from '@nestjs/common';

import type { Coordinate } from '../../common/geo';
import { ArahException } from '../../security/weather-errors';
import { PlacesService } from '../places/places.service';
import { RoutesService } from '../routes/routes.service';
import { TrafficService } from '../traffic/traffic.service';
import { TripsService } from '../trips/trips.service';
import { WeatherService } from '../weather/weather.service';
import { validateToolArgs, type JsonSchema } from './tool-schema';

export type AiClientContext = {
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp?: string | null;
  };
  navigation?: {
    remainingMeters: number;
    remainingSeconds: number;
    eta: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
};

export type ToolStatus = 'ok' | 'unavailable' | 'rejected';

export type ToolActivity = {
  name: string;
  status: ToolStatus;
  activity: string;
};

type ToolDefinition = {
  name: string;
  description: string;
  activity: string;
  schema: JsonSchema;
  run: (args: Record<string, unknown>, context: AiClientContext & { userId: string }) => Promise<unknown>;
};

const coordinate = { latitude: { type: 'number' as const, minimum: -90, maximum: 90 }, longitude: { type: 'number' as const, minimum: -180, maximum: 180 } };

@Injectable()
export class ArahToolRegistry {
  private readonly tools: ToolDefinition[];

  constructor(
    private readonly places: PlacesService,
    private readonly routes: RoutesService,
    private readonly trips: TripsService,
    private readonly weather: WeatherService,
    private readonly traffic: TrafficService,
  ) {
    this.tools = [
      tool('getCurrentLocation', 'Read the signed-in user location supplied by the Arah app. Never invent coordinates.', 'Finding your location...', emptySchema(), async (_args, context) => {
        const location = context.location;
        if (!location) return unavailable('LOCATION_UNAVAILABLE');
        return {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy ?? null,
          heading: location.heading ?? null,
          speed: location.speed ?? null,
          timestamp: location.timestamp ?? null,
        };
      }),
      tool(
        'searchPlace',
        'Search Arah places by name. Use this before routing when the user names a destination.',
        'Searching for destination...',
        { type: 'object', properties: { query: { type: 'string', maxLength: 120 } }, required: ['query'] },
        async (args) => {
          const places = await this.places.search(String(args.query));
          return places.slice(0, 5).map((place) => ({
            name: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
            address: place.address,
          }));
        },
      ),
      tool('calculateRoute', 'Calculate one driving route through Arah. Avoid flags are not applied.', 'Calculating route...', routeSchema(), (args, context) => this.routeResult(args, context, false)),
      tool('getAlternativeRoutes', 'Calculate alternative driving routes through Arah and compare them with the first route.', 'Calculating route...', routeSchema(), (args, context) => this.routeResult(args, context, true)),
      tool('getETA', 'Read arrival time from the active Arah navigation, or from a real route preview when both ends are known.', 'Calculating route...', routeSchema(false), async (args, context) => {
        if (context.navigation) {
          return {
            source: 'navigation',
            eta: new Date(context.navigation.eta).toISOString(),
            remainingDistanceMeters: context.navigation.remainingMeters,
            remainingDurationSeconds: context.navigation.remainingSeconds,
          };
        }
        const ends = routeEnds(args, context, false);
        if ('code' in ends) return ends;
        const routes = await this.preview(ends.origin, ends.destination);
        const first = routes[0];
        if (!first) return unavailable('ROUTE_UNAVAILABLE');
        return {
          source: 'route_preview',
          eta: new Date(Date.now() + first.durationSeconds * 1000).toISOString(),
          remainingDistanceMeters: first.distanceMeters,
          remainingDurationSeconds: first.durationSeconds,
        };
      }),
      tool('getCurrentSpeed', 'Read the current GPS speed supplied by the Arah app.', 'Checking your speed...', emptySchema(), async (_args, context) => {
        const speed = context.location?.speed;
        if (speed === undefined || speed === null || !Number.isFinite(speed)) return unavailable('SPEED_UNAVAILABLE');
        return { speed, unit: 'm/s', timestamp: context.location?.timestamp ?? null };
      }),
      tool('getTripStats', 'Read summary statistics for the signed-in user latest stored trip.', 'Reading your trip...', emptySchema(), async (_args, context) => {
        const trips = await this.trips.list(context.userId, 20);
        const latest = trips[0] ?? null;
        if (!latest) return unavailable('TRIP_UNAVAILABLE');
        return summarizeTrip(latest);
      }),
      tool('getTripHistory', 'Read summarized stored trips for the signed-in user.', 'Reading your trips...', { type: 'object', properties: { limit: { type: 'number', minimum: 1, maximum: 20 } } }, async (args, context) => {
        const limit = typeof args.limit === 'number' ? Math.round(args.limit) : 10;
        const trips = (await this.trips.list(context.userId, limit)).map(summarizeTrip);
        const longest = trips.reduce<(typeof trips)[number] | null>((best, trip) => ((trip.distanceMeters ?? 0) > (best?.distanceMeters ?? 0) ? trip : best), null);
        return {
          count: trips.length,
          totalDistanceMeters: trips.reduce((sum, trip) => sum + (trip.distanceMeters ?? 0), 0),
          lastTrip: trips[0] ?? null,
          longestTrip: longest,
          trips,
        };
      }),
      tool('getRoadHistory', 'Road history aggregation is not available.', 'Checking road history...', emptySchema(), async () => unavailable('ROAD_HISTORY_NOT_AVAILABLE')),
      tool(
        'getWeather',
        'Read current weather for explicit coordinates or the app location. Do not call a weather provider yourself.',
        'Checking weather...',
        { type: 'object', properties: coordinate },
        async (args, context) => {
          const point = optionalPoint(args, context.location);
          if ('code' in point) return point;
          try {
            const weather = await this.weather.current(point.latitude, point.longitude);
            return { location: weather.location, weather: weather.weather };
          } catch (error) {
            return providerFailure(error, 'WEATHER_PROVIDER_NOT_CONFIGURED');
          }
        },
      ),
      tool(
        'getTraffic',
        'Read live traffic flow and incidents for explicit coordinates or the app location.',
        'Checking traffic...',
        { type: 'object', properties: coordinate },
        async (args, context) => {
          const point = optionalPoint(args, context.location);
          if ('code' in point) return point;
          const report = await this.traffic.report(point.latitude, point.longitude);
          if (!report.available) {
            if (report.reason === 'not_configured' || report.reason === 'auth_failed') return unavailable('TRAFFIC_PROVIDER_NOT_CONFIGURED');
            return unavailable('TRAFFIC_UNAVAILABLE');
          }
          return { flow: report.flow, incidents: report.incidents };
        },
      ),
    ];
  }

  declarations() {
    return this.tools.map((entry) => ({ name: entry.name, description: entry.description, parameters: entry.schema }));
  }

  async execute(name: string, rawArgs: unknown, context: AiClientContext & { userId: string }): Promise<{ result: unknown; activity: ToolActivity }> {
    const entry = this.tools.find((candidate) => candidate.name === name);
    if (!entry) {
      return { result: unavailable('AI_TOOL_NOT_FOUND'), activity: { name, status: 'rejected', activity: 'Could not complete that lookup.' } };
    }
    const parsed = validateToolArgs(entry.schema, rawArgs ?? {});
    if (!parsed.ok) {
      return { result: unavailable('AI_TOOL_INVALID_ARGUMENTS'), activity: { name, status: 'rejected', activity: entry.activity } };
    }
    try {
      const result = bound(await entry.run(parsed.args, context));
      const status: ToolStatus = isUnavailable(result) ? 'unavailable' : 'ok';
      return { result, activity: { name, status, activity: entry.activity } };
    } catch {
      return { result: unavailable('AI_TOOL_EXECUTION_FAILED'), activity: { name, status: 'unavailable', activity: entry.activity } };
    }
  }

  private async routeResult(args: Record<string, unknown>, context: AiClientContext, alternatives: boolean): Promise<unknown> {
    const ends = routeEnds(args, context, true);
    if ('code' in ends) return ends;
    const routes = await this.preview(ends.origin, ends.destination);
    if (routes.length === 0) return unavailable('ROUTE_UNAVAILABLE');
    const primary = summarizeRoute(routes[0]);
    const constraints = {
      avoidTolls: args.avoidTolls === true ? 'not_supported' : 'not_requested',
      avoidHighways: args.avoidHighways === true ? 'not_supported' : 'not_requested',
    };
    if (!alternatives) return { ...primary, constraints };
    return {
      constraints,
      routes: routes.slice(0, 3).map((route, index) => ({
        ...summarizeRoute(route),
        differenceFromPrimary: {
          distanceMeters: route.distanceMeters - routes[0].distanceMeters,
          durationSeconds: route.durationSeconds - routes[0].durationSeconds,
          index,
        },
      })),
    };
  }

  private async preview(origin: Coordinate, destination: Coordinate) {
    try {
      return await this.routes.preview(origin, destination);
    } catch {
      return [];
    }
  }
}

function tool(
  name: string,
  description: string,
  activity: string,
  schema: JsonSchema,
  run: ToolDefinition['run'],
): ToolDefinition {
  return { name, description, activity, schema, run };
}

function emptySchema(): JsonSchema {
  return { type: 'object', properties: {} };
}

function routeSchema(requireDestination = true): JsonSchema {
  return {
    type: 'object',
    properties: {
      originLatitude: coordinate.latitude,
      originLongitude: coordinate.longitude,
      destinationLatitude: coordinate.latitude,
      destinationLongitude: coordinate.longitude,
      avoidTolls: { type: 'boolean' },
      avoidHighways: { type: 'boolean' },
    },
    required: requireDestination ? ['destinationLatitude', 'destinationLongitude'] : [],
  };
}

function routeEnds(args: Record<string, unknown>, context: AiClientContext, requireDestination: boolean): { origin: Coordinate; destination: Coordinate } | { code: string } {
  const destination = pair(args.destinationLatitude, args.destinationLongitude) ?? context.destination ?? null;
  const origin = pair(args.originLatitude, args.originLongitude) ?? (context.location ? { latitude: context.location.latitude, longitude: context.location.longitude } : null);
  if (!origin || (requireDestination && !destination) || !destination) return unavailable('ROUTE_UNAVAILABLE');
  return { origin, destination };
}

function optionalPoint(args: Record<string, unknown>, location: AiClientContext['location']): Coordinate | { code: string } {
  const explicit = pair(args.latitude, args.longitude);
  if (explicit) return explicit;
  if (args.latitude !== undefined || args.longitude !== undefined) return unavailable('AI_TOOL_INVALID_ARGUMENTS');
  if (!location) return unavailable('LOCATION_UNAVAILABLE');
  return { latitude: location.latitude, longitude: location.longitude };
}

function pair(latitude: unknown, longitude: unknown): Coordinate | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
}

function summarizeRoute(route: { summary: string; distanceMeters: number; durationSeconds: number; geometry: Coordinate[] }) {
  const start = route.geometry[0] ?? null;
  const end = route.geometry[route.geometry.length - 1] ?? null;
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    summary: route.summary,
    geometryPointCount: route.geometry.length,
    start,
    end,
    steps: [],
  };
}

function summarizeTrip(trip: {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  movingSeconds: number | null;
  stoppedSeconds: number | null;
  averageSpeedMps: number | null;
  maxSpeedMps: number | null;
  originName: string | null;
  destinationName: string | null;
  status: string;
}) {
  return {
    id: trip.id,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    durationSeconds: trip.durationSeconds,
    distanceMeters: trip.distanceMeters,
    movingSeconds: trip.movingSeconds,
    stoppedSeconds: trip.stoppedSeconds,
    averageSpeedMps: trip.averageSpeedMps,
    maximumSpeedMps: trip.maxSpeedMps,
    originName: trip.originName,
    destinationName: trip.destinationName,
    status: trip.status,
  };
}

function unavailable(code: string): { code: string } {
  return { code };
}

function isUnavailable(result: unknown): boolean {
  return Boolean(result && typeof result === 'object' && 'code' in result && typeof (result as { code?: unknown }).code === 'string');
}

function providerFailure(error: unknown, fallback: string): { code: string } {
  if (error instanceof ArahException) {
    const body = error.getResponse();
    if (body && typeof body === 'object' && 'code' in body && typeof (body as { code?: unknown }).code === 'string') {
      return { code: (body as { code: string }).code };
    }
  }
  return { code: fallback };
}

function bound(result: unknown): unknown {
  const text = JSON.stringify(result);
  if (text.length <= 6000) return result;
  return unavailable('AI_TOOL_EXECUTION_FAILED');
}
