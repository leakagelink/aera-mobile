import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { RateLimitGuard } from './cache/rate-limit.guard';
import { CacheModule } from './cache/cache.module';
import { DevelopmentUserGuard } from './common/guards/development-user.guard';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AdminGuard } from './modules/admin/admin.guard';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { ProviderConfigModule } from './modules/provider-config/provider-config.module';
import { WeatherModule } from './modules/weather/weather.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NavigationModule } from './modules/navigation/navigation.module';
import { PlacesModule } from './modules/places/places.module';
import { RoutesModule } from './modules/routes/routes.module';
import { TripsModule } from './modules/trips/trips.module';
import { UsersModule } from './modules/users/users.module';
import { ProviderModule } from './providers/provider.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CacheModule,
    ProviderModule,
    ProviderConfigModule,
    HealthModule,
    UsersModule,
    TripsModule,
    RoutesModule,
    PlacesModule,
    LocationsModule,
    NavigationModule,
    WeatherModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: DevelopmentUserGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
