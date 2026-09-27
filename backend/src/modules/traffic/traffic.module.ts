import { Module } from '@nestjs/common';

import { TomTomTrafficProvider } from '../../providers/tomtom-traffic.provider';
import { TrafficService } from './traffic.service';

@Module({
  providers: [TrafficService, TomTomTrafficProvider],
  exports: [TrafficService],
})
export class TrafficModule {}
