import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { DEV_USER_ID } from '../src/config/constants';
import { TripsController } from '../src/modules/trips/trips.controller';
import { TripsService } from '../src/modules/trips/trips.service';

const tripId = '22222222-2222-4222-8222-222222222222';

describe('trip API validation', () => {
  const trips = {
    create: jest.fn(async () => ({ id: tripId })),
    addSamples: jest.fn(async () => ({ stored: 1 })),
    complete: jest.fn(async () => ({ id: tripId, status: 'completed' })),
    get: jest.fn(async () => ({ id: tripId, status: 'active' })),
    list: jest.fn(async () => []),
    samples: jest.fn(async () => []),
    remove: jest.fn(),
  };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TripsController],
      providers: [{ provide: TripsService, useValue: trips }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: { user?: { id: string; developmentOnly: boolean } }, _res: unknown, next: () => void) => {
      req.user = { id: DEV_USER_ID, developmentOnly: true };
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts a trip', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/trips').send({ startedAt: new Date().toISOString() });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: tripId });
    expect(trips.create).toHaveBeenCalledWith(DEV_USER_ID, expect.objectContaining({ startedAt: expect.any(String) }));
  });

  it('rejects a GPS sample with an impossible latitude', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/samples`)
      .send({
        samples: [
          {
            recordedAt: new Date().toISOString(),
            latitude: 999,
            longitude: 77.59,
            accuracy: 5,
            speed: 1,
            heading: 10,
          },
        ],
      });
    expect(response.status).toBe(400);
    expect(trips.addSamples).not.toHaveBeenCalled();
  });

  it('retrieves a trip and its samples', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/v1/trips/${tripId}`);
    const samples = await request(app.getHttpServer()).get(`/api/v1/trips/${tripId}/samples`);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(tripId);
    expect(samples.status).toBe(200);
    expect(samples.body).toEqual([]);
  });
});
