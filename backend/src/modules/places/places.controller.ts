import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { PlaceSearchQueryDto, ReverseQueryDto, SavePlaceDto } from './dto';
import { PlacesService } from './places.service';

@Controller('v1/places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  search(@Query() query: PlaceSearchQueryDto) {
    return this.places.search(query.q);
  }

  @Get('reverse')
  reverse(@Query() query: ReverseQueryDto) {
    return this.places.reverse(query.latitude, query.longitude);
  }

  @Get('saved')
  saved(@Req() request: { user: RequestUser }) {
    return this.places.saved(request.user.id);
  }

  @Post()
  save(@Req() request: { user: RequestUser }, @Body() body: SavePlaceDto) {
    return this.places.save(request.user.id, body);
  }

  @Delete(':id')
  remove(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.places.remove(request.user.id, id);
  }
}
