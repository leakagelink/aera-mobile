import { Injectable } from '@nestjs/common';

import type { Coordinate } from '../../common/geo';
import { DatabaseService } from '../../database/database.service';

export type SavedPlace = Coordinate & {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
  distanceMeters?: number;
};

@Injectable()
export class PlacesRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(userId: string, place: { name: string; address?: string; latitude: number; longitude: number }): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await this.database.query(
      `INSERT INTO saved_places (id, user_id, name, address, latitude, longitude, location)
       VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography)`,
      [id, userId, place.name, place.address ?? null, place.latitude, place.longitude],
    );
    return { id };
  }

  async list(userId: string): Promise<SavedPlace[]> {
    const result = await this.database.query<{
      id: string;
      name: string;
      address: string | null;
      latitude: number;
      longitude: number;
      created_at: Date;
    }>(
      `SELECT id, name, address, latitude, longitude, created_at
       FROM saved_places WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [userId],
    );
    return result.rows.map(toPlace);
  }

  async nearby(userId: string, coordinate: Coordinate, radiusMeters: number): Promise<SavedPlace[]> {
    const result = await this.database.query<{
      id: string;
      name: string;
      address: string | null;
      latitude: number;
      longitude: number;
      created_at: Date;
      distance_meters: number;
    }>(
      `SELECT id, name, address, latitude, longitude, created_at,
              ST_Distance(location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography) AS distance_meters
       FROM saved_places
       WHERE user_id = $1
         AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
       ORDER BY distance_meters ASC
       LIMIT 20`,
      [userId, coordinate.latitude, coordinate.longitude, radiusMeters],
    );
    return result.rows.map((row) => ({ ...toPlace(row), distanceMeters: row.distance_meters }));
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM saved_places WHERE id = $1 AND user_id = $2', [id, userId]);
    return (result.rowCount ?? 0) > 0;
  }
}

function toPlace(row: {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  created_at: Date;
}): SavedPlace {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at.toISOString(),
  };
}
