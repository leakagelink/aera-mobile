import { Controller, Get, Query, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { TrafficService } from '../traffic/traffic.service';
import { TripsService } from '../trips/trips.service';

class TrafficQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

@Controller('v1/navigation')
export class NavigationController {
  constructor(
    private readonly trips: TripsService,
    private readonly trafficService: TrafficService,
  ) {}

  @Get('active')
  active(@Req() request: { user: RequestUser }) {
    return this.trips.active(request.user.id);
  }

  @Get('traffic')
  async traffic(@Query() query: TrafficQueryDto) {
    const report = await this.trafficService.report(query.lat, query.lng);
    if (!report.available && report.reason === 'not_configured') {
      return { available: false, reason: 'not_configured' };
    }
    return report;
  }
}
