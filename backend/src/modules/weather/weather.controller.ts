import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { RedisService } from '../../cache/redis.service';
import { WeatherService } from './weather.service';

class CurrentWeatherQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

@Injectable()
export class WeatherRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const allowed = await this.redis.takeToken(`aera:rl:weather:${request.ip ?? 'unknown'}`, 30, 60);
    if (!allowed) {
      throw new HttpException({ message: 'Too many weather requests. Try again shortly.', code: 'WEATHER_PROVIDER_RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}

@Controller('v1/weather')
@UseGuards(WeatherRateLimitGuard)
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('current')
  current(@Query() query: CurrentWeatherQueryDto) {
    return this.weather.current(query.lat, query.lng);
  }
}
