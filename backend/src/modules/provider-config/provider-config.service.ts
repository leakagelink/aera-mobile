import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { catalogEntry, providerStatus, type ProviderHealthStatus, type ProviderSlug, type ProviderType } from '../../providers/catalog';
import { SecretEncryptionService } from '../../security/secret-encryption.service';
import { stripSecretFields } from '../../security/sanitize';
import { ProviderConfigRepository, type ProviderRow } from './provider-config.repository';

export type PublicProviderConfig = {
  id: string;
  provider: string;
  providerType: ProviderType;
  name: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  model: string | null;
  enabled: boolean;
  isDefault: boolean;
  timeoutMs: number;
  configJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastTestedAt: string | null;
  lastTestStatus: 'success' | 'failure' | null;
  lastTestMessage: string | null;
  lastTestLatencyMs: number | null;
  lastSuccessAt: string | null;
  status: ProviderHealthStatus;
};

export type ResolvedProvider = {
  provider: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string | null;
  timeoutMs: number;
  enabled: boolean;
  source: 'database' | 'environment';
};

export type ProviderWrite = {
  provider: ProviderSlug;
  providerType: ProviderType;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model?: string | null;
  enabled: boolean;
  isDefault?: boolean;
  timeoutMs: number;
  configJson?: Record<string, unknown>;
};

@Injectable()
export class ProviderConfigService {
  constructor(
    private readonly providers: ProviderConfigRepository,
    private readonly encryption: SecretEncryptionService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(): Promise<PublicProviderConfig[]> {
    const rows = await this.providers.list();
    return rows.map((row) => this.toPublic(row));
  }

  async get(id: string): Promise<PublicProviderConfig> {
    const row = await this.providers.findById(id);
    if (!row) throw new NotFoundException('Provider not found.');
    return this.toPublic(row);
  }

  async create(input: ProviderWrite): Promise<PublicProviderConfig> {
    this.assertPair(input.provider, input.providerType);
    const existing = await this.providers.findByProvider(input.provider);
    if (existing) throw new BadRequestException('That provider is already configured.');
    const secret = this.encryptIfPresent(input.apiKey);
    const id = crypto.randomUUID();
    const isDefault = Boolean(input.isDefault);
    if (isDefault) await this.providers.clearDefault(input.providerType, id);
    await this.providers.insert({
      id,
      provider: input.provider,
      providerType: input.providerType,
      name: input.name.trim(),
      baseUrl: trimBase(input.baseUrl),
      apiKeyEncrypted: secret?.encrypted ?? null,
      apiKeyLast4: secret?.last4 ?? null,
      model: cleanModel(input.model),
      enabled: input.enabled,
      isDefault,
      timeoutMs: input.timeoutMs,
      configJson: stripSecretFields(input.configJson ?? {}),
    });
    return this.get(id);
  }

  async update(id: string, input: Partial<ProviderWrite>): Promise<{ config: PublicProviderConfig; keyUpdated: boolean; enabledChanged: boolean | null }> {
    const current = await this.providers.findById(id);
    if (!current) throw new NotFoundException('Provider not found.');
    const provider = (input.provider ?? current.provider) as ProviderSlug;
    const providerType = input.providerType ?? current.provider_type;
    this.assertPair(provider, providerType);
    const nextKey = resolveKeyUpdate(input.apiKey, current, this.encryption, this.config.secretEncryptionKey);
    const isDefault = input.isDefault ?? current.is_default;
    if (input.isDefault === true) {
      await this.providers.clearDefault(providerType, id);
    }
    const enabled = input.enabled ?? current.enabled;
    await this.providers.update(id, {
      name: (input.name ?? current.name).trim(),
      baseUrl: trimBase(input.baseUrl ?? current.base_url),
      apiKeyEncrypted: nextKey.encrypted,
      apiKeyLast4: nextKey.last4,
      model: input.model === undefined ? current.model : cleanModel(input.model),
      enabled,
      isDefault,
      timeoutMs: input.timeoutMs ?? current.timeout_ms,
      configJson: input.configJson ? stripSecretFields(input.configJson) : stripSecretFields(current.config_json),
    });
    return {
      config: await this.get(id),
      keyUpdated: nextKey.replaced,
      enabledChanged: input.enabled === undefined || input.enabled === current.enabled ? null : input.enabled,
    };
  }

  async remove(id: string): Promise<{ provider: string }> {
    const current = await this.providers.findById(id);
    if (!current) throw new NotFoundException('Provider not found.');
    await this.providers.remove(id);
    return { provider: current.provider };
  }

  async resolve(providerType: ProviderType, provider: ProviderSlug): Promise<ResolvedProvider | null> {
    const row = await this.providers.findActive(providerType);
    if (row && row.provider === provider) {
      if (!row.enabled) return { provider, providerType, baseUrl: row.base_url, apiKey: null, timeoutMs: row.timeout_ms, enabled: false, source: 'database' };
      return {
        provider,
        providerType,
        baseUrl: row.base_url,
        apiKey: this.decryptOrEnv(row, provider),
        timeoutMs: row.timeout_ms,
        enabled: true,
        source: 'database',
      };
    }
    if (row && row.provider !== provider) return null;
    return this.environmentFallback(provider, providerType);
  }

  activeGemini(): Promise<(ResolvedProvider & { model: string }) | null> {
    return this.activeKeyed('ai', 'gemini', this.config.geminiApiKey, 'https://generativelanguage.googleapis.com', this.config.geminiModel);
  }

  activeTomTom(): Promise<ResolvedProvider | null> {
    return this.activeKeyed('traffic', 'tomtom', this.config.tomtomApiKey, 'https://api.tomtom.com', null);
  }

  async activeWeather(): Promise<ResolvedProvider | null> {
    const row = await this.providers.findPreferred('weather');
    if (row) {
      return {
        provider: row.provider,
        providerType: 'weather',
        baseUrl: row.base_url,
        apiKey: row.enabled && row.api_key_encrypted ? this.decryptStored(row.api_key_encrypted) : row.enabled ? this.config.openWeatherApiKey : null,
        timeoutMs: row.timeout_ms,
        enabled: row.enabled && row.provider === 'openweather',
        source: 'database',
      };
    }
    if (!this.config.openWeatherApiKey) return null;
    return {
      provider: 'openweather',
      providerType: 'weather',
      baseUrl: this.config.openWeatherBaseUrl,
      apiKey: this.config.openWeatherApiKey,
      timeoutMs: 10_000,
      enabled: true,
      source: 'environment',
    };
  }

  secretFor(row: ProviderRow): string | null {
    if (!row.api_key_encrypted) return this.envKey(row.provider);
    return this.decryptStored(row.api_key_encrypted);
  }

  toPublic(row: ProviderRow): PublicProviderConfig {
    const configured = Boolean(row.api_key_encrypted) || Boolean(this.envKey(row.provider)) || !catalogEntry(row.provider)?.requiresApiKey;
    return {
      id: row.id,
      provider: row.provider,
      providerType: row.provider_type,
      name: row.name,
      baseUrl: row.base_url,
      apiKeyConfigured: Boolean(row.api_key_encrypted) || Boolean(this.envKey(row.provider)),
      apiKeyLast4: row.api_key_last4,
      model: row.model,
      enabled: row.enabled,
      isDefault: row.is_default,
      timeoutMs: row.timeout_ms,
      configJson: stripSecretFields(row.config_json),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      lastTestedAt: row.last_tested_at?.toISOString() ?? null,
      lastTestStatus: row.last_test_status,
      lastTestMessage: row.last_test_message,
      lastTestLatencyMs: row.last_test_latency_ms,
      lastSuccessAt: row.last_success_at?.toISOString() ?? null,
      status: providerStatus({ configured, enabled: row.enabled, lastTestStatus: row.last_test_status }),
    };
  }

  private async activeKeyed(type: ProviderType, slug: ProviderSlug, envKey: string | null, fallbackUrl: string, model: string | null): Promise<(ResolvedProvider & { model: string }) | null> {
    const row = await this.providers.findPreferred(type);
    if (row) {
      const enabled = row.enabled && row.provider === slug;
      return {
        provider: row.provider,
        providerType: type,
        baseUrl: row.base_url,
        apiKey: enabled && row.api_key_encrypted ? this.decryptStored(row.api_key_encrypted) : enabled ? envKey : null,
        timeoutMs: row.timeout_ms,
        enabled,
        source: 'database',
        model: row.model?.trim() || model || 'gemini-2.0-flash',
      };
    }
    if (!envKey) return null;
    return { provider: slug, providerType: type, baseUrl: fallbackUrl, apiKey: envKey, timeoutMs: 10_000, enabled: true, source: 'environment', model: model || 'gemini-2.0-flash' };
  }

  private decryptOrEnv(row: ProviderRow, provider: string): string | null {
    if (row.api_key_encrypted) return this.decryptStored(row.api_key_encrypted);
    return this.envKey(provider);
  }

  private decryptStored(payload: string): string {
    if (!this.config.secretEncryptionKey) {
      throw new ServiceUnavailableException('Server encryption is not configured.');
    }
    try {
      return this.encryption.decrypt(payload, this.config.secretEncryptionKey);
    } catch {
      throw new ServiceUnavailableException('Stored provider secret could not be read.');
    }
  }

  private encryptIfPresent(apiKey: string | undefined): { encrypted: string; last4: string } | null {
    const trimmed = apiKey?.trim();
    if (!trimmed) return null;
    if (trimmed.length < 8) throw new BadRequestException('API key is too short.');
    if (!this.config.secretEncryptionKey) throw new ServiceUnavailableException('Server encryption is not configured.');
    return { encrypted: this.encryption.encrypt(trimmed, this.config.secretEncryptionKey), last4: trimmed.slice(-4) };
  }

  private envKey(provider: string): string | null {
    if (provider === 'openweather') return this.config.openWeatherApiKey;
    if (provider === 'gemini') return this.config.geminiApiKey;
    if (provider === 'tomtom') return this.config.tomtomApiKey;
    return null;
  }

  private environmentFallback(provider: ProviderSlug, providerType: ProviderType): ResolvedProvider | null {
    const entry = catalogEntry(provider);
    if (!entry || entry.providerType !== providerType) return null;
    const apiKey = this.envKey(provider);
    if (entry.requiresApiKey && !apiKey) return null;
    const baseUrl =
      provider === 'openweather'
        ? this.config.openWeatherBaseUrl
        : provider === 'osrm'
          ? this.config.routingBaseUrl
          : provider === 'nominatim'
            ? this.config.geocodingBaseUrl
            : provider === 'martin'
              ? this.config.mapTileBaseUrl
              : entry.defaultBaseUrl;
    if (!baseUrl) return null;
    return { provider, providerType, baseUrl, apiKey, timeoutMs: 10_000, enabled: true, source: 'environment' };
  }

  private assertPair(provider: string, providerType: ProviderType): void {
    const entry = catalogEntry(provider);
    if (!entry || entry.providerType !== providerType) {
      throw new BadRequestException('Provider and provider type do not match.');
    }
  }
}

function resolveKeyUpdate(
  apiKey: string | undefined,
  current: ProviderRow,
  encryption: SecretEncryptionService,
  key: Buffer | null,
): { encrypted: string | null; last4: string | null; replaced: boolean } {
  if (apiKey === undefined || apiKey.trim() === '') {
    return { encrypted: current.api_key_encrypted, last4: current.api_key_last4, replaced: false };
  }
  const trimmed = apiKey.trim();
  if (trimmed.length < 8) throw new BadRequestException('API key is too short.');
  if (!key) throw new ServiceUnavailableException('Server encryption is not configured.');
  return { encrypted: encryption.encrypt(trimmed, key), last4: trimmed.slice(-4), replaced: true };
}

function trimBase(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function cleanModel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
