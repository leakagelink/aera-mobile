import { Module } from '@nestjs/common';

import { ElevenLabsProvider } from '../../providers/elevenlabs.provider';
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
import { VoiceService } from './voice.service';

@Module({
  imports: [PlacesModule, RoutesModule, TripsModule, WeatherModule, TrafficModule],
  controllers: [AiController],
  providers: [AiService, VoiceService, ArahToolRegistry, GeminiProvider, RelayProvider, ElevenLabsProvider],
})
export class AiModule {}
