import { Injectable } from '@nestjs/common';

import { lineStringWkt, type Coordinate } from '../../common/geo';
import { DatabaseService, type Sql } from '../../database/database.service';
import type { TripMetrics } from './trip-metrics';

export type TripSampleInput = Coordinate & {
  recordedAt: string;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
};

type TripRow = {
  id: string;
  started_at: Date;
  ended_at: Date | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  moving_seconds: number | null;
  stopped_seconds: number | null;
  average_speed_mps: number | null;
  max_speed_mps: number | null;
  last_known_progress: number | null;
  origin_name: string | null;
  destination_name: string | null;
  status: 'active' | 'completed';
  created_at: Date;
  start_latitude: number | null;
  start_longitude: number | null;
  end_latitude: number | null;
  end_longitude: number | null;
  planned_route_geojson?: string | null;
};

@Injectable()
export class TripsRepository {
  constructor(private readonly database: DatabaseService) {}

  async insertTrip(input: {
    id: string;
    userId: string;
    startedAt: string;
    originName?: string;
    destinationName?: string;
    plannedGeometry?: Coordinate[];
  }): Promise<void> {
    const line = input.plannedGeometry ? lineStringWkt(input.plannedGeometry) : null;
    const start = input.plannedGeometry?.[0];
    await this.database.query(
      `INSERT INTO trips (
         id, user_id, started_at, origin_name, destination_name, start_location, planned_route_geometry
       ) VALUES (
         $1, $2, $3, $4, $5,
         CASE WHEN $6::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography END,
         CASE WHEN $8::text IS NULL THEN NULL ELSE ST_GeogFromText($8) END
       )`,
      [
        input.id,
        input.userId,
        input.startedAt,
        input.originName ?? null,
        input.destinationName ?? null,
        start?.latitude ?? null,
        start?.longitude ?? null,
        line,
      ],
    );
  }

  findOwned(id: string, userId: string): Promise<{ status: 'active' | 'completed'; startedAt: string } | null> {
    return this.database
      .query<{ status: 'active' | 'completed'; started_at: Date }>('SELECT status, started_at FROM trips WHERE id = $1 AND user_id = $2', [id, userId])
      .then((result) => {
        const row = result.rows[0];
        return row ? { status: row.status, startedAt: row.started_at.toISOString() } : null;
      });
  }

  async insertSamples(tripId: string, userId: string, samples: TripSampleInput[]): Promise<void> {
    const last = samples[samples.length - 1];
    await this.database.withTransaction(async (query) => {
      for (const sample of samples) {
        await query(
          `INSERT INTO trip_samples (
             id, trip_id, recorded_at, latitude, longitude, altitude, accuracy, speed, heading, location_geometry
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography
           )`,
          [
            crypto.randomUUID(),
            tripId,
            sample.recordedAt,
            sample.latitude,
            sample.longitude,
            sample.altitude,
            sample.accuracy,
            sample.speed,
            sample.heading,
          ],
        );
      }
      if (last) await locateProgress(query, tripId, userId, last);
    });
  }

  async listSamples(tripId: string): Promise<TripSampleInput[]> {
    const result = await this.database.query<{
      recorded_at: Date;
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
      speed: number | null;
      heading: number | null;
    }>(
      `SELECT recorded_at, latitude, longitude, altitude, accuracy, speed, heading
       FROM trip_samples WHERE trip_id = $1 ORDER BY recorded_at ASC`,
      [tripId],
    );
    return result.rows.map((row) => ({
      recordedAt: row.recorded_at.toISOString(),
      latitude: row.latitude,
      longitude: row.longitude,
      altitude: row.altitude,
      accuracy: row.accuracy,
      speed: row.speed,
      heading: row.heading,
    }));
  }

  async complete(id: string, userId: string, endedAt: string, metrics: TripMetrics, end: Coordinate | null): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE trips SET
         ended_at = $3,
         status = 'completed',
         duration_seconds = $4,
         distance_meters = $5,
         moving_seconds = $6,
         stopped_seconds = $7,
         average_speed_mps = $8,
         max_speed_mps = $9,
         end_location = CASE WHEN $10::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($11, $10), 4326)::geography END,
         last_known_progress = CASE
           WHEN planned_route_geometry IS NULL OR $10::float8 IS NULL THEN last_known_progress
           ELSE ST_LineLocatePoint(planned_route_geometry::geometry, ST_SetSRID(ST_MakePoint($11, $10), 4326))
         END
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [
        id,
        userId,
        endedAt,
        metrics.durationSeconds,
        metrics.distanceMeters,
        metrics.movingSeconds,
        metrics.stoppedSeconds,
        metrics.averageSpeedMps,
        metrics.maxSpeedMps,
        end?.latitude ?? null,
        end?.longitude ?? null,
      ],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(userId: string, limit: number): Promise<ReturnType<typeof toTrip>[]> {
    const result = await this.database.query<TripRow>(`${tripSelect} WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`, [userId, limit]);
    return result.rows.map((row) => toTrip(row));
  }

  async get(id: string, userId: string): Promise<ReturnType<typeof toTrip> | null> {
    const result = await this.database.query<TripRow>(
      `SELECT ${tripColumns}, ST_AsGeoJSON(planned_route_geometry::geometry) AS planned_route_geojson FROM trips WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = result.rows[0];
    return row ? toTrip(row, true) : null;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async active(userId: string): Promise<ReturnType<typeof toTrip> | null> {
    const result = await this.database.query<TripRow>(`${tripSelect} WHERE user_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`, [userId]);
    const row = result.rows[0];
    return row ? toTrip(row) : null;
  }
}

const tripColumns = `
  id, started_at, ended_at, duration_seconds, distance_meters, moving_seconds, stopped_seconds,
  average_speed_mps, max_speed_mps, last_known_progress, origin_name, destination_name, status, created_at,
  ST_Y(start_location::geometry) AS start_latitude,
  ST_X(start_location::geometry) AS start_longitude,
  ST_Y(end_location::geometry) AS end_latitude,
  ST_X(end_location::geometry) AS end_longitude
`;

const tripSelect = `SELECT ${tripColumns} FROM trips`;

async function locateProgress(query: Sql, tripId: string, userId: string, point: Coordinate): Promise<void> {
  await query(
    `UPDATE trips SET last_known_progress = ST_LineLocatePoint(planned_route_geometry::geometry, ST_SetSRID(ST_MakePoint($4, $3), 4326))
     WHERE id = $1 AND user_id = $2 AND planned_route_geometry IS NOT NULL`,
    [tripId, userId, point.latitude, point.longitude],
  );
}

function toTrip(row: TripRow, includeGeometry = false) {
  return {
    id: row.id,
    startedAt: row.started_at.toISOString(),
    endedAt: row.ended_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    movingSeconds: row.moving_seconds,
    stoppedSeconds: row.stopped_seconds,
    averageSpeedMps: row.average_speed_mps,
    maxSpeedMps: row.max_speed_mps,
    lastKnownProgress: row.last_known_progress,
    originName: row.origin_name,
    destinationName: row.destination_name,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    startLocation: point(row.start_latitude, row.start_longitude),
    endLocation: point(row.end_latitude, row.end_longitude),
    ...(includeGeometry ? { plannedRoute: parseGeoJson(row.planned_route_geojson) } : {}),
  };
}

function point(latitude: number | null, longitude: number | null): Coordinate | null {
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function parseGeoJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
