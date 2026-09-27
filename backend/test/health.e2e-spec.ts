import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RedisService } from '../src/cache/redis.service';
import { DatabaseService } from '../src/database/database.service';
import { HealthController } from '../src/modules/health/health.controller';

describe('GET /api/v1/health', () => {
  async function createApp(database: boolean, redis: boolean): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DatabaseService, useValue: { ping: async () => database } },
        { provide: RedisService, useValue: { ping: async () => redis } },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    return app;
  }

  it('reports the API, PostgreSQL, and Redis', async () => {
    const app = await createApp(true, true);
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'ok', redis: 'ok' });
    await app.close();
  });

  it('reports a dependency outage without internal details', async () => {
    const app = await createApp(false, true);
    const response = await request(app.getHttpServer()).get('/api/v1/health');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'degraded', database: 'down', redis: 'ok' });
    await app.close();
  });
});
