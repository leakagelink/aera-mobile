import { Controller, Get, Query, Req } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { NearbyQueryDto } from '../places/dto';
import { PlacesService } from '../places/places.service';

@Controller('v1/locations')
export class LocationsController {
  constructor(private readonly places: PlacesService) {}

  @Get('nearby')
  nearby(@Req() request: { user: RequestUser }, @Query() query: NearbyQueryDto) {
    return this.places.nearby(request.user.id, query.latitude, query.longitude, query.radiusMeters ?? 200);
  }
}
