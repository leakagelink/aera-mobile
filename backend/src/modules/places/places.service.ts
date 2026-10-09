import { createHash } from 'node:crypto';

import { BadGatewayException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { RedisService } from '../../cache/redis.service';
import { distanceMeters, type Coordinate } from '../../common/geo';
import { PROVIDERS } from '../../providers/provider.module';
import type { ProviderSet } from '../../providers/registry';
import type { PlaceResult } from '../../providers/types';
import { PlacesRepository } from './places.repository';

@Injectable()
export class PlacesService {
  constructor(
    private readonly places: PlacesRepository,
    private readonly redis: RedisService,
    @Inject(PROVIDERS) private readonly providers: ProviderSet,
  ) {}

  async search(query: string): Promise<PlaceResult[]> {
    const key = `aera:place:${digest(query.trim().toLowerCase())}`;
    const cached = await this.readCache<PlaceResult[]>(key);
    if (cached) return cached;
    const places = await this.providers.search.search(query.trim());
    await this.redis.set(key, JSON.stringify(places), 60);
    return places;
  }

  async searchNearby(query: string, coordinate: Coordinate, radiusMeters: number): Promise<Array<PlaceResult & { distanceMeters: number }>> {
    const places = await this.providers.search.searchNearby(query, coordinate, radiusMeters);
    return places
      .map((place) => ({ ...place, distanceMeters: Math.round(distanceMeters(coordinate, place)) }))
      .filter((place) => place.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, 5);
  }

  async reverse(latitude: number, longitude: number): Promise<PlaceResult | null> {
    const key = `aera:reverse:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = await this.redis.get(key);
    if (cached === 'null') return null;
    if (cached) return this.readCache<PlaceResult>(key);
    const place = await this.providers.geocoding.reverse({ latitude, longitude });
    await this.redis.set(key, JSON.stringify(place), 60);
    return place;
  }

  save(userId: string, input: { name: string; address?: string; latitude: number; longitude: number }) {
    return this.places.insert(userId, input);
  }

  saved(userId: string) {
    return this.places.list(userId);
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const deleted = await this.places.remove(id, userId);
    if (!deleted) throw new NotFoundException('Place not found.');
    return { deleted: true };
  }

  nearby(userId: string, latitude: number, longitude: number, radiusMeters = 200) {
    return this.places.nearby(userId, { latitude, longitude }, radiusMeters);
  }

  private async readCache<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new BadGatewayException('Cached place data was unreadable.');
    }
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
