import { Module } from '@nestjs/common';

import { TrafficModule } from '../traffic/traffic.module';
import { TripsModule } from '../trips/trips.module';
import { NavigationController } from './navigation.controller';

@Module({
  imports: [TripsModule, TrafficModule],
  controllers: [NavigationController],
})
export class NavigationModule {}
