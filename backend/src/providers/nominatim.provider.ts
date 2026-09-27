import { BadGatewayException } from '@nestjs/common';

import type { Coordinate } from '../common/geo';
import { fetchJson } from './http';
import type { GeocodingProvider, PlaceResult, PlaceSearchProvider } from './types';

const MIN_INTERVAL_MS = 1100;

type NominatimRow = {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string | null;
  error?: string;
};

export class NominatimProvider implements PlaceSearchProvider, GeocodingProvider {
  readonly id = 'nominatim';
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
  ) {}

  search(query: string): Promise<PlaceResult[]> {
    const url = new URL('/search', this.baseUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '6');
    return this.schedule(async () => {
      const payload = await this.read(url);
      if (!Array.isArray(payload)) throw new BadGatewayException('Place search is unavailable.');
      return payload.flatMap((row) => {
        const place = toPlace(asRow(row));
        return place ? [place] : [];
      });
    });
  }

  reverse(coordinate: Coordinate): Promise<PlaceResult | null> {
    const url = new URL('/reverse', this.baseUrl);
    url.searchParams.set('lat', String(coordinate.latitude));
    url.searchParams.set('lon', String(coordinate.longitude));
    url.searchParams.set('format', 'jsonv2');
    return this.schedule(async () => {
      const payload = await this.read(url);
      const row = asRow(payload);
      if (row.error) return null;
      return toPlace(row);
    });
  }

  private async read(url: URL): Promise<unknown> {
    try {
      return await fetchJson(url.toString(), {
        Accept: 'application/json',
        'User-Agent': this.userAgent,
        Referer: 'https://github.com/leakagelink/aera-mobile',
      });
    } catch {
      throw new BadGatewayException('Place search is unavailable.');
    }
  }

  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - this.lastRequestAt));
      if (wait > 0) await delay(wait);
      this.lastRequestAt = Date.now();
      return task();
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function asRow(value: unknown): NominatimRow {
  return value && typeof value === 'object' ? (value as NominatimRow) : {};
}

function toPlace(row: NominatimRow): PlaceResult | null {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !row.display_name || row.place_id === undefined) return null;
  const name = row.name?.trim() || row.display_name.split(',')[0]?.trim() || 'Place';
  return { id: String(row.place_id), name, address: row.display_name, latitude, longitude };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
