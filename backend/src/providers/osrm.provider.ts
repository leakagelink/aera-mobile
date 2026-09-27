import { BadGatewayException } from '@nestjs/common';

import type { Coordinate } from '../common/geo';
import { fetchJson } from './http';
import type { RouteLeg, RoutingProvider } from './types';

type OsrmResponse = {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
    legs?: { summary?: string }[];
  }[];
};

export class OsrmProvider implements RoutingProvider {
  readonly id = 'osrm';

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
  ) {}

  async calculate(origin: Coordinate, destination: Coordinate): Promise<RouteLeg[]> {
    const path = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = new URL(`/route/v1/driving/${path}`, this.baseUrl);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('steps', 'false');
    url.searchParams.set('alternatives', 'true');
    let payload: unknown;
    try {
      payload = await fetchJson(
        url.toString(),
        { Accept: 'application/json', 'User-Agent': this.userAgent },
        15_000,
      );
    } catch {
      throw new BadGatewayException('Routing is unavailable.');
    }
    const body = payload as OsrmResponse;
    if (body.code !== 'Ok' || !body.routes?.length) {
      throw new BadGatewayException(
        body.code === 'NoRoute' || body.code === 'NoSegment'
          ? 'No driving route is available between these places.'
          : 'Routing is unavailable.',
      );
    }
    return body.routes.map((route, index) => toLeg(route, index));
  }
}

function toLeg(route: NonNullable<OsrmResponse['routes']>[number], index: number): RouteLeg {
  const geometry = (route.geometry?.coordinates ?? []).flatMap(([longitude, latitude]) =>
    Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ latitude, longitude }] : [],
  );
  if (geometry.length < 2 || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
    throw new BadGatewayException('Routing returned an incomplete route.');
  }
  const summary = (route.legs ?? []).map((leg) => leg.summary?.trim()).filter((value): value is string => Boolean(value)).join(' · ');
  return {
    label: index === 0 ? 'Recommended' : `Alternative ${index}`,
    summary: summary || 'Driving route',
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry,
  };
}
