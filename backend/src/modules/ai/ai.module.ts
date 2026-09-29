import { Module } from '@nestjs/common';

import { GeminiProvider } from '../../providers/gemini.provider';
import { RelayProvider } from '../../providers/relay.provider';
import { PlacesModule } from '../places/places.module';
import { RoutesModule } from '../routes/routes.module';
import { TrafficModule } from '../traffic/traffic.module';
import { TripsModule } from '../trips/trips.module';
import { WeatherModule } from '../weather/weather.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ArahToolRegistry } from './tool-registry';

@Module({
  imports: [PlacesModule, RoutesModule, TripsModule, WeatherModule, TrafficModule],
  controllers: [AiController],
  providers: [AiService, ArahToolRegistry, GeminiProvider, RelayProvider],
})
export class AiModule {}
