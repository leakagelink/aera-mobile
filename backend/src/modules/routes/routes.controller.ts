import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min, ValidateNested } from 'class-validator';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { RoutesService } from './routes.service';

class RoutePointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

class CalculateRouteDto {
  @ValidateNested()
  @Type(() => RoutePointDto)
  origin!: RoutePointDto;

  @ValidateNested()
  @Type(() => RoutePointDto)
  destination!: RoutePointDto;
}

@Controller('v1/routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Post()
  calculate(@Req() request: { user: RequestUser }, @Body() body: CalculateRouteDto) {
    return this.routes.calculate(request.user.id, body.origin, body.destination);
  }

  @Get()
  list(@Req() request: { user: RequestUser }) {
    return this.routes.list(request.user.id);
  }

  @Get(':id')
  get(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.routes.get(request.user.id, id);
  }

  @Delete(':id')
  remove(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.routes.remove(request.user.id, id);
  }
}
