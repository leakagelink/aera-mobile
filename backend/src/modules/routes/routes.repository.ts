import { Injectable } from '@nestjs/common';

import { distanceMeters, lineStringWkt, type Coordinate } from '../../common/geo';
import { DatabaseService } from '../../database/database.service';
import type { RouteLeg } from '../../providers/types';

@Injectable()
export class RoutesRepository {
  constructor(private readonly database: DatabaseService) {}

  async save(userId: string, route: RouteLeg): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const line = lineStringWkt(route.geometry);
    if (!line) throw new Error('Route geometry is incomplete.');
    await this.database.withTransaction(async (query) => {
      await query(
        `INSERT INTO routes (id, user_id, provider, label, summary, distance_meters, duration_seconds, geometry)
         VALUES ($1, $2, 'osrm', $3, $4, $5, $6, ST_GeogFromText($7))`,
        [id, userId, route.label, route.summary, route.distanceMeters, route.durationSeconds, line],
      );
      for (let index = 0; index < route.geometry.length - 1; index += 1) {
        const start = route.geometry[index];
        const end = route.geometry[index + 1];
        if (!start || !end) continue;
        const segment = lineStringWkt([start, end]);
        if (!segment) continue;
        await query(
          `INSERT INTO route_segments (id, route_id, segment_index, length_meters, geometry)
           VALUES ($1, $2, $3, $4, ST_GeogFromText($5))`,
          [crypto.randomUUID(), id, index, distanceMeters(start, end), segment],
        );
      }
    });
    return { id };
  }

  async list(userId: string) {
    const result = await this.database.query<{
      id: string;
      provider: string;
      label: string;
      summary: string;
      distance_meters: number;
      duration_seconds: number;
      created_at: Date;
    }>(
      `SELECT id, provider, label, summary, distance_meters, duration_seconds, created_at
       FROM routes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      label: row.label,
      summary: row.summary,
      distanceMeters: row.distance_meters,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async get(id: string, userId: string) {
    const result = await this.database.query<{
      id: string;
      provider: string;
      label: string;
      summary: string;
      distance_meters: number;
      duration_seconds: number;
      created_at: Date;
      geometry: string;
    }>(
      `SELECT id, provider, label, summary, distance_meters, duration_seconds, created_at,
              ST_AsGeoJSON(geometry::geometry) AS geometry
       FROM routes WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      label: row.label,
      summary: row.summary,
      distanceMeters: row.distance_meters,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at.toISOString(),
      geometry: JSON.parse(row.geometry) as unknown,
    };
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM routes WHERE id = $1 AND user_id = $2', [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}
