import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { CreateTripDto, ListQueryDto, SampleBatchDto } from './dto';
import { TripsService } from './trips.service';

@Controller('v1/trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  create(@Req() request: { user: RequestUser }, @Body() body: CreateTripDto) {
    return this.trips.create(request.user.id, body);
  }

  @Get()
  list(@Req() request: { user: RequestUser }, @Query() query: ListQueryDto) {
    return this.trips.list(request.user.id, query.limit ?? 20);
  }

  @Get(':id')
  get(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.get(request.user.id, id);
  }

  @Delete(':id')
  remove(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.remove(request.user.id, id);
  }

  @Post(':id/samples')
  samples(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string, @Body() body: SampleBatchDto) {
    return this.trips.addSamples(
      request.user.id,
      id,
      body.samples.map((sample) => ({
        recordedAt: sample.recordedAt,
        latitude: sample.latitude,
        longitude: sample.longitude,
        altitude: sample.altitude ?? null,
        accuracy: sample.accuracy ?? null,
        speed: sample.speed ?? null,
        heading: sample.heading ?? null,
      })),
    );
  }

  @Post(':id/complete')
  complete(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.complete(request.user.id, id);
  }

  @Get(':id/samples')
  listSamples(@Req() request: { user: RequestUser }, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.samples(request.user.id, id);
  }
}
