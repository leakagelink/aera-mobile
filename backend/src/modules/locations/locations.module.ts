import { Module } from '@nestjs/common';

import { PlacesModule } from '../places/places.module';
import { LocationsController } from './locations.controller';

@Module({
  imports: [PlacesModule],
  controllers: [LocationsController],
})
export class LocationsModule {}
