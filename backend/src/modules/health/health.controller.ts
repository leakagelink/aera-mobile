import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RedisService } from '../../cache/redis.service';
import { Public } from '../../common/decorators/public.decorator';
import { DatabaseService } from '../../database/database.service';

@Controller('v1/health')
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async health(@Res({ passthrough: true }) response: Response) {
    const [database, redis] = await Promise.all([this.database.ping(), this.redis.ping()]);
    const body = {
      status: database && redis ? 'ok' : 'degraded',
      database: database ? 'ok' : 'down',
      redis: redis ? 'ok' : 'down',
    };
    response.status(body.status === 'ok' ? 200 : 503);
    return body;
  }
}
