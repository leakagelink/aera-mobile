import { Module } from '@nestjs/common';

import { PlacesController } from './places.controller';
import { PlacesRepository } from './places.repository';
import { PlacesService } from './places.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesRepository, PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}
