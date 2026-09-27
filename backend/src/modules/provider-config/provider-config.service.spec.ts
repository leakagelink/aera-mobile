import { BadRequestException } from '@nestjs/common';

import type { AppConfig } from '../../config/load-config';
import { SecretEncryptionService } from '../../security/secret-encryption.service';
import { ProviderConfigService } from './provider-config.service';
import type { ProviderRow } from './provider-config.repository';

const key = Buffer.alloc(32, 9);
const encryption = new SecretEncryptionService();

function row(overrides: Partial<ProviderRow> = {}): ProviderRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    provider: 'openweather',
    provider_type: 'weather',
    name: 'OpenWeather',
    base_url: 'https://api.openweathermap.org',
    api_key_encrypted: encryption.encrypt('test-key-1234', key),
    api_key_last4: '1234',
    model: null,
    enabled: true,
    is_default: false,
    timeout_ms: 10000,
    config_json: { apiKey: 'test-key-1234', units: 'metric' },
    created_at: new Date('2026-09-27T00:00:00.000Z'),
    updated_at: new Date('2026-09-27T00:00:00.000Z'),
    last_tested_at: null,
    last_test_status: null,
    last_test_message: null,
    last_test_latency_ms: null,
    last_success_at: null,
    ...overrides,
  };
}

function service(stored: ProviderRow | null, envKey: string | null = null) {
  const repository = {
    list: jest.fn(async () => (stored ? [stored] : [])),
    findById: jest.fn(async () => stored),
    findByProvider: jest.fn(async () => stored),
    findPreferred: jest.fn(async () => stored),
    findActive: jest.fn(async () => (stored?.enabled ? stored : null)),
    insert: jest.fn(),
    update: jest.fn(),
    clearDefault: jest.fn(),
    remove: jest.fn(async () => true),
    markTest: jest.fn(),
  };
  const config = { secretEncryptionKey: key, openWeatherApiKey: envKey, openWeatherBaseUrl: 'https://api.openweathermap.org' } as AppConfig;
  return { service: new ProviderConfigService(repository as never, encryption, config), repository };
}

describe('ProviderConfigService', () => {
  it('returns the last four characters and never the stored key', () => {
    const { service: configs } = service(row());
    const view = configs.toPublic(row());
    expect(view.apiKeyConfigured).toBe(true);
    expect(view.apiKeyLast4).toBe('1234');
    expect(JSON.stringify(view)).not.toContain('test-key-1234');
    expect(view.configJson).toEqual({ units: 'metric' });
    expect(view.status).toBe('NOT CONFIGURED');
  });

  it('keeps an empty key update from replacing the stored secret', async () => {
    const current = row();
    const { service: configs, repository } = service(current);
    await configs.update(current.id, { apiKey: '   ' });
    expect(repository.update).toHaveBeenCalledWith(current.id, expect.objectContaining({ apiKeyEncrypted: current.api_key_encrypted, apiKeyLast4: '1234' }));
  });

  it('refuses to mark an untested provider as the default', async () => {
    const current = row();
    const { service: configs } = service(current);
    await expect(configs.update(current.id, { isDefault: true })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the database row before the environment fallback', async () => {
    const current = row({ enabled: true });
    const { service: configs } = service(current, 'env-key-5678');
    const resolved = await configs.activeWeather();
    expect(resolved?.source).toBe('database');
    expect(resolved?.apiKey).toBe('test-key-1234');
  });

  it('does not use the environment key when the database provider is disabled', async () => {
    const current = row({ enabled: false });
    const { service: configs } = service(current, 'env-key-5678');
    const resolved = await configs.activeWeather();
    expect(resolved?.enabled).toBe(false);
    expect(resolved?.apiKey).toBeNull();
  });

  it('falls back to the environment when no database row exists', async () => {
    const { service: configs } = service(null, 'env-key-5678');
    const resolved = await configs.activeWeather();
    expect(resolved).toMatchObject({ source: 'environment', apiKey: 'env-key-5678', enabled: true });
  });
});
