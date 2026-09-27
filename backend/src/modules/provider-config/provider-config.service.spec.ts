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

  it('stores the key and enabled flag when default is turned on before a test', async () => {
    const current = row({ provider: 'gemini', provider_type: 'ai', name: 'Gemini', enabled: false, api_key_encrypted: null, api_key_last4: null });
    const { service: configs, repository } = service(current);
    await configs.update(current.id, { isDefault: true, enabled: true, apiKey: 'gemini-key-1234' });
    expect(repository.clearDefault).toHaveBeenCalledWith('ai', current.id);
    expect(repository.update).toHaveBeenCalledWith(
      current.id,
      expect.objectContaining({ isDefault: true, enabled: true, apiKeyLast4: '1234' }),
    );
  });

  it('creates a provider as the default before any test and keeps the key', async () => {
    let stored: ProviderRow | null = null;
    const repository = {
      list: jest.fn(async () => []),
      findByProvider: jest.fn(async () => null),
      findById: jest.fn(async () => stored),
      insert: jest.fn(async (input: { id: string; provider: string; providerType: ProviderRow['provider_type']; name: string; baseUrl: string; apiKeyEncrypted: string | null; apiKeyLast4: string | null; model: string | null; enabled: boolean; isDefault: boolean; timeoutMs: number }) => {
        stored = row({
          id: input.id,
          provider: input.provider,
          provider_type: input.providerType,
          name: input.name,
          base_url: input.baseUrl,
          api_key_encrypted: input.apiKeyEncrypted,
          api_key_last4: input.apiKeyLast4,
          model: input.model,
          enabled: input.enabled,
          is_default: input.isDefault,
          timeout_ms: input.timeoutMs,
        });
      }),
      clearDefault: jest.fn(),
    };
    const configs = new ProviderConfigService(repository as never, encryption, { secretEncryptionKey: key } as AppConfig);
    const created = await configs.create({
      provider: 'gemini',
      providerType: 'ai',
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'gemini-key-1234',
      enabled: true,
      isDefault: true,
      timeoutMs: 10000,
    });
    expect(created.enabled).toBe(true);
    expect(created.isDefault).toBe(true);
    expect(created.apiKeyConfigured).toBe(true);
    expect(created.apiKeyLast4).toBe('1234');
    expect(JSON.stringify(created)).not.toContain('gemini-key-1234');
  });

  it('rejects a key that is already saved for another provider', async () => {
    const weather = row();
    const tomtom = row({
      id: '22222222-2222-4222-8222-222222222222',
      provider: 'tomtom',
      provider_type: 'traffic',
      name: 'TomTom',
      api_key_encrypted: null,
      api_key_last4: null,
    });
    const repository = {
      list: jest.fn(async () => [weather, tomtom]),
      findById: jest.fn(async () => tomtom),
      update: jest.fn(),
      clearDefault: jest.fn(),
    };
    const configs = new ProviderConfigService(repository as never, encryption, { secretEncryptionKey: key } as AppConfig);
    await expect(configs.update(tomtom.id, { apiKey: 'test-key-1234' })).rejects.toThrow('already saved for OpenWeather');
    expect(repository.update).not.toHaveBeenCalled();
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
