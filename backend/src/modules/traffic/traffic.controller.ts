import { BadRequestException, CanActivate, Controller, ExecutionContext, Get, HttpException, HttpStatus, Injectable, Query, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';

import { RedisService } from '../../cache/redis.service';
import { TrafficService } from './traffic.service';

class FlowQueryDto {
  @IsString()
  @MaxLength(240)
  points!: string;
}

@Injectable()
export class TrafficRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const allowed = await this.redis.takeToken(`aera:rl:traffic:${request.ip ?? 'unknown'}`, 12, 60);
    if (!allowed) {
      throw new HttpException({ message: 'Too many traffic requests. Try again shortly.', code: 'TRAFFIC_PROVIDER_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}

@Controller('v1/traffic')
@UseGuards(TrafficRateLimitGuard)
export class TrafficController {
  constructor(private readonly traffic: TrafficService) {}

  @Get('flow')
  flow(@Query() query: FlowQueryDto) {
    return this.traffic.flowSamples(parsePoints(query.points));
  }
}

function parsePoints(raw: string): { latitude: number; longitude: number }[] {
  const parts = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 4) throw new BadRequestException('Send one to four coordinates.');
  return parts.map((part) => {
    const [latitudeText, longitudeText] = part.split(',');
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new BadRequestException('Each point must be latitude,longitude.');
    }
    return { latitude, longitude };
  });
}
