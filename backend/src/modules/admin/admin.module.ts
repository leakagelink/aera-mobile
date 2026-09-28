import { Module } from '@nestjs/common';

import { AdminApiController } from './admin-api.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminGuard } from './admin.guard';
import { AdminProviderService } from './admin-provider.service';
import { AuditRepository } from './audit.repository';
import { GoogleIntegrationService } from './google-integration.service';

@Module({
  controllers: [AdminAuthController, AdminApiController],
  providers: [AdminAuthService, AdminBootstrapService, AdminGuard, AdminProviderService, AuditRepository, GoogleIntegrationService],
  exports: [AdminGuard, GoogleIntegrationService],
})
export class AdminModule {}
