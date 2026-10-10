import { Module } from '@nestjs/common';

import { TomTomTrafficProvider } from '../../providers/tomtom-traffic.provider';
import { TrafficController, TrafficRateLimitGuard } from './traffic.controller';
import { TrafficService } from './traffic.service';

@Module({
  controllers: [TrafficController],
  providers: [TrafficService, TrafficRateLimitGuard, TomTomTrafficProvider],
  exports: [TrafficService],
})
export class TrafficModule {}
