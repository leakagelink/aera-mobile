import { Module } from '@nestjs/common';

import { OpenWeatherProvider } from '../../providers/openweather.provider';
import { WeatherController, WeatherRateLimitGuard } from './weather.controller';
import { WeatherService } from './weather.service';

@Module({
  controllers: [WeatherController],
  providers: [WeatherService, WeatherRateLimitGuard, OpenWeatherProvider],
  exports: [WeatherService],
})
export class WeatherModule {}
