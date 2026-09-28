import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';

import { Admin } from './admin.decorator';
import { AdminProviderService } from './admin-provider.service';
import { GoogleIntegrationService } from './google-integration.service';
import type { AdminRequest } from './admin.guard';
import { AuditQueryDto, CreateProviderDto, UpdateGoogleIntegrationDto, UpdateProviderDto } from './dto';

@Admin()
@Controller('v1/admin')
export class AdminApiController {
  constructor(
    private readonly admin: AdminProviderService,
    private readonly google: GoogleIntegrationService,
  ) {}

  @Get('providers/catalog')
  catalog() {
    return this.admin.catalog();
  }

  @Get('providers')
  list() {
    return this.admin.list();
  }

  @Post('providers/health-check')
  healthCheck(@Req() request: AdminRequest) {
    return this.admin.testAll(request.admin?.id ?? '', request.ip ?? null);
  }

  @Get('providers/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.get(id);
  }

  @Post('providers')
  create(@Body() body: CreateProviderDto, @Req() request: AdminRequest) {
    return this.admin.create(body, request.admin?.id ?? '', request.ip ?? null);
  }

  @Patch('providers/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateProviderDto, @Req() request: AdminRequest) {
    return this.admin.update(id, body, request.admin?.id ?? '', request.ip ?? null);
  }

  @Delete('providers/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: AdminRequest) {
    return this.admin.remove(id, request.admin?.id ?? '', request.ip ?? null);
  }

  @Post('providers/:id/test')
  test(@Param('id', ParseUUIDPipe) id: string, @Req() request: AdminRequest) {
    return this.admin.test(id, request.admin?.id ?? '', request.ip ?? null);
  }

  @Get('system/health')
  system() {
    return this.admin.systemHealth();
  }

  @Get('settings')
  settings() {
    return this.admin.settings();
  }

  @Get('google')
  googleIntegration() {
    return this.google.view();
  }

  @Patch('google')
  updateGoogle(
    @Body() body: UpdateGoogleIntegrationDto,
    @Req() request: AdminRequest,
  ) {
    return this.google.update(body, request.admin?.id ?? '', request.ip ?? null);
  }

  @Post('google/test')
  testGoogle(@Req() request: AdminRequest) {
    return this.google.test(request.admin?.id ?? '', request.ip ?? null);
  }

  @Get('audit-logs')
  audit(@Query() query: AuditQueryDto) {
    return this.admin.auditLogs(query.limit ?? 50);
  }
}
