import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { catalogEntry, PROVIDER_CATALOG, type ProviderSlug } from '../../providers/catalog';
import { DatabaseService } from '../../database/database.service';
import { RedisService } from '../../cache/redis.service';
import { ProviderConfigRepository } from '../provider-config/provider-config.repository';
import { ProviderConfigService, type ProviderWrite } from '../provider-config/provider-config.service';
import { AuditRepository } from './audit.repository';
import { probeProvider, type ProbeResult } from './provider-probe';

@Injectable()
export class AdminProviderService {
  constructor(
    private readonly configs: ProviderConfigService,
    private readonly rows: ProviderConfigRepository,
    private readonly audit: AuditRepository,
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  catalog() {
    return PROVIDER_CATALOG;
  }

  list() {
    return this.configs.list();
  }

  get(id: string) {
    return this.configs.get(id);
  }

  async create(input: ProviderWrite, adminId: string, ipAddress: string | null) {
    const created = await this.configs.create(input);
    await this.audit.insert({ adminId, action: `${created.name} provider created`, provider: created.provider, success: true, ipAddress });
    if (input.apiKey?.trim()) {
      await this.audit.insert({ adminId, action: `${created.name} API key updated`, provider: created.provider, success: true, ipAddress });
    }
    return created;
  }

  async update(id: string, input: Partial<ProviderWrite>, adminId: string, ipAddress: string | null) {
    const result = await this.configs.update(id, input);
    if (result.keyUpdated) {
      await this.audit.insert({ adminId, action: `${result.config.name} API key updated`, provider: result.config.provider, success: true, ipAddress });
    }
    if (result.enabledChanged === true) {
      await this.audit.insert({ adminId, action: `${result.config.name} provider enabled`, provider: result.config.provider, success: true, ipAddress });
    }
    if (result.enabledChanged === false) {
      await this.audit.insert({ adminId, action: `${result.config.name} provider disabled`, provider: result.config.provider, success: true, ipAddress });
    }
    return result.config;
  }

  async remove(id: string, adminId: string, ipAddress: string | null) {
    const removed = await this.configs.remove(id);
    await this.audit.insert({ adminId, action: `${removed.provider} provider deleted`, provider: removed.provider, success: true, ipAddress });
    return { deleted: true };
  }

  async test(id: string, adminId: string, ipAddress: string | null): Promise<ProbeResult> {
    const row = await this.rows.findById(id);
    if (!row) throw new BadRequestException('Provider not found.');
    const entry = catalogEntry(row.provider);
    if (!entry) throw new BadRequestException('Provider is not supported.');
    const apiKey = this.configs.secretFor(row);
    const result = await probeProvider(entry.provider, { baseUrl: row.base_url, apiKey, timeoutMs: row.timeout_ms }, this.config);
    const makeDefault = result.success && row.enabled && row.provider_type === 'weather';
    await this.rows.markTest(id, { status: result.success ? 'success' : 'failure', message: result.message, latencyMs: result.latencyMs, makeDefault });
    await this.audit.insert({
      adminId,
      action: `${row.name} connection tested`,
      provider: row.provider,
      success: result.success,
      ipAddress,
    });
    return result;
  }

  async testAll(adminId: string, ipAddress: string | null) {
    const rows = await this.rows.list();
    const results = [];
    for (const row of rows) {
      if (!row.enabled) {
        results.push({ id: row.id, provider: row.provider, success: false, latencyMs: 0, message: 'Provider is disabled', status: 'DISABLED' as const });
        continue;
      }
      const result = await this.test(row.id, adminId, ipAddress);
      results.push({ id: row.id, provider: row.provider, ...result });
    }
    return results;
  }

  async systemHealth() {
    const [database, redis] = await Promise.all([this.database.ping(), this.redis.ping()]);
    return {
      status: database && redis ? 'ok' : 'degraded',
      backend: 'ok',
      database: database ? 'ok' : 'down',
      redis: redis ? 'ok' : 'down',
    };
  }

  settings() {
    return {
      encryptionKeyConfigured: Boolean(this.config.secretEncryptionKey),
      adminAuthConfigured: Boolean(this.config.adminJwtSecret),
      openWeatherEnvConfigured: Boolean(this.config.openWeatherApiKey),
      geminiEnvConfigured: Boolean(this.config.geminiApiKey),
      tomtomEnvConfigured: Boolean(this.config.tomtomApiKey),
      weatherCacheTtlSeconds: this.config.weatherCacheTtlSeconds,
    };
  }

  auditLogs(limit: number) {
    return this.audit.list(limit);
  }
}

export function isProviderSlug(value: string): value is ProviderSlug {
  return catalogEntry(value) !== null;
}
