import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/load-config';
import { createProviders, type ProviderSet } from './registry';

export const PROVIDERS = Symbol('PROVIDERS');

@Global()
@Module({
  providers: [
    {
      provide: PROVIDERS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): ProviderSet => createProviders(config),
    },
  ],
  exports: [PROVIDERS],
})
export class ProviderModule {}
