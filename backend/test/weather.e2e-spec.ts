import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { DEV_USER_ID } from '../src/config/constants';
import { WeatherController, WeatherRateLimitGuard } from '../src/modules/weather/weather.controller';
import { WeatherService } from '../src/modules/weather/weather.service';

describe('GET /api/v1/weather/current', () => {
  let app: INestApplication;
  const current = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WeatherController],
      providers: [{ provide: WeatherService, useValue: { current } }],
    })
      .overrideGuard(WeatherRateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
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
    await app?.close();
  });

  it('rejects an invalid latitude before calling the weather service', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/weather/current').query({ lat: 999, lng: 75.85 });
    expect(response.status).toBe(400);
    expect(current).not.toHaveBeenCalled();
  });
});
