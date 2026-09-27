import { Controller, Get, Inject, Req } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { PROVIDERS } from '../../providers/provider.module';
import type { ProviderSet } from '../../providers/registry';
import { TripsService } from '../trips/trips.service';

@Controller('v1/navigation')
export class NavigationController {
  constructor(
    private readonly trips: TripsService,
    @Inject(PROVIDERS) private readonly providers: ProviderSet,
  ) {}

  @Get('active')
  active(@Req() request: { user: RequestUser }) {
    return this.trips.active(request.user.id);
  }

  @Get('traffic')
  traffic() {
    return this.providers.traffic.report();
  }
}
