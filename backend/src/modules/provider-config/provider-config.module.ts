import { Global, Module } from '@nestjs/common';

import { SecretEncryptionService } from '../../security/secret-encryption.service';
import { ProviderConfigRepository } from './provider-config.repository';
import { ProviderConfigService } from './provider-config.service';

@Global()
@Module({
  providers: [ProviderConfigRepository, ProviderConfigService, SecretEncryptionService],
  exports: [ProviderConfigService, ProviderConfigRepository, SecretEncryptionService],
})
export class ProviderConfigModule {}
