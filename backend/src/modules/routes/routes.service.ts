import { createHash } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { RedisService } from '../../cache/redis.service';
import type { Coordinate } from '../../common/geo';
import { PROVIDERS } from '../../providers/provider.module';
import type { ProviderSet } from '../../providers/registry';
import type { RouteLeg } from '../../providers/types';
import { RoutesRepository } from './routes.repository';

@Injectable()
export class RoutesService {
  constructor(
    private readonly routes: RoutesRepository,
    private readonly redis: RedisService,
    @Inject(PROVIDERS) private readonly providers: ProviderSet,
  ) {}

  async calculate(userId: string, origin: Coordinate, destination: Coordinate) {
    const key = `aera:route:${digest(origin)}:${digest(destination)}`;
    const cached = await this.redis.get(key);
    const alternatives = cached ? parseRoutes(cached) : await this.providers.routing.calculate(origin, destination);
    if (!cached) await this.redis.set(key, JSON.stringify(alternatives), 120);
    const recommended = alternatives[0];
    const saved = recommended ? await this.routes.save(userId, recommended) : null;
    return { savedRouteId: saved?.id ?? null, routes: alternatives };
  }

  list(userId: string) {
    return this.routes.list(userId);
  }

  async get(userId: string, id: string) {
    const route = await this.routes.get(id, userId);
    if (!route) throw new NotFoundException('Route not found.');
    return route;
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const deleted = await this.routes.remove(id, userId);
    if (!deleted) throw new NotFoundException('Route not found.');
    return { deleted: true };
  }
}

function parseRoutes(value: string): RouteLeg[] {
  const parsed = JSON.parse(value) as RouteLeg[];
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Cached route was empty.');
  return parsed;
}

function digest(coordinate: Coordinate): string {
  return createHash('sha256').update(`${coordinate.latitude.toFixed(3)},${coordinate.longitude.toFixed(3)}`).digest('hex').slice(0, 16);
}
