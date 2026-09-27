import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { TripsRepository } from './trips.repository';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const tripId = '11111111-1111-4111-8111-111111111111';

  function repository() {
    return {
      insertTrip: jest.fn(async () => undefined),
      insertSamples: jest.fn(async () => undefined),
      findOwned: jest.fn(async () => ({ status: 'active' as const, startedAt: '2026-09-27T06:00:00.000Z' })),
      listSamples: jest.fn(async () => [
        {
          id: 's1',
          recordedAt: '2026-09-27T06:00:00.000Z',
          latitude: 12.97,
          longitude: 77.59,
          altitude: null,
          accuracy: 5,
          speed: 4,
          heading: 10,
        },
        {
          id: 's2',
          recordedAt: '2026-09-27T06:00:10.000Z',
          latitude: 12.971,
          longitude: 77.59,
          altitude: null,
          accuracy: 5,
          speed: 4,
          heading: 10,
        },
      ]),
      complete: jest.fn(async () => true),
      get: jest.fn(async (): Promise<{ id: string; status: string } | null> => ({ id: tripId, status: 'completed' })),
      list: jest.fn(),
      remove: jest.fn(),
      active: jest.fn(),
    };
  }

  it('completes a trip from stored samples instead of client metrics', async () => {
    const trips = repository();
    const moduleRef = await Test.createTestingModule({
      providers: [TripsService, { provide: TripsRepository, useValue: trips }],
    }).compile();
    const service = moduleRef.get(TripsService);
    await expect(service.complete(userId, tripId)).resolves.toEqual({ id: tripId, status: 'completed' });
    const metrics = (trips.complete.mock.calls[0] as unknown[] | undefined)?.[3] as { distanceMeters: number; durationSeconds: number };
    expect(metrics.distanceMeters).toBeGreaterThan(100);
    expect(metrics.durationSeconds).toBeGreaterThan(0);
  });

  it('returns a trip owned by the caller', async () => {
    const trips = repository();
    const moduleRef = await Test.createTestingModule({
      providers: [TripsService, { provide: TripsRepository, useValue: trips }],
    }).compile();
    await expect(moduleRef.get(TripsService).get(userId, tripId)).resolves.toMatchObject({ id: tripId });
  });

  it('hides a trip that does not belong to the caller', async () => {
    const trips = repository();
    trips.get.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [TripsService, { provide: TripsRepository, useValue: trips }],
    }).compile();
    await expect(moduleRef.get(TripsService).get(userId, tripId)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('spatial schema', () => {
  const sql = readFileSync(join(__dirname, '../../../migrations/001_init.sql'), 'utf8');

  it('stores locations as PostGIS geography with spatial indexes', () => {
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS postgis');
    expect(sql).toContain('GEOGRAPHY(POINT, 4326)');
    expect(sql).toContain('GEOGRAPHY(LINESTRING, 4326)');
    expect(sql).toContain('USING GIST (location_geometry)');
    expect(sql).toContain('USING GIST (start_location)');
  });

  it('keeps future road statistics free of user identifiers', () => {
    const stats = sql.slice(sql.indexOf('CREATE TABLE road_segment_stats'));
    expect(stats).toContain('segment_key');
    expect(stats).not.toContain('user_id');
  });
});
