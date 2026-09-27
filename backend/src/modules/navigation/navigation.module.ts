import { Module } from '@nestjs/common';

import { TripsModule } from '../trips/trips.module';
import { NavigationController } from './navigation.controller';

@Module({
  imports: [TripsModule],
  controllers: [NavigationController],
})
export class NavigationModule {}
