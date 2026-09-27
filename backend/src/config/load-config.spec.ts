import { loadConfig } from './load-config';

const base = {
  DATABASE_URL: 'postgresql://aera:replace-with-a-local-password@localhost:5432/aera',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadConfig', () => {
  it('accepts the local development providers', () => {
    const config = loadConfig(base);
    expect(config.geocodingProvider).toBe('nominatim');
    expect(config.routingProvider).toBe('osrm');
    expect(config.authMode).toBe('development');
    expect(config.devUserId).toBe('00000000-0000-4000-8000-000000000001');
    expect(config.openWeatherApiKey).toBeNull();
    expect(config.openWeatherBaseUrl).toBe('https://api.openweathermap.org');
    expect(config.secretEncryptionKey).toBeNull();
  });

  it('rejects a missing database URL', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: ' ' })).toThrow('DATABASE_URL is required.');
  });

  it('rejects an unknown geocoding provider', () => {
    expect(() => loadConfig({ ...base, GEOCODING_PROVIDER: 'supabase' })).toThrow('Unsupported value');
  });

  it('refuses the development user when NODE_ENV is production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow('NODE_ENV=production requires AUTH_MODE=jwt.');
  });

  it('accepts production when each account has its own secret', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      AUTH_MODE: 'jwt',
      USER_JWT_SECRET: 'u'.repeat(32),
      ADMIN_JWT_SECRET: 'a'.repeat(32),
      AERA_SECRET_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    });
    expect(config.authMode).toBe('jwt');
    expect(config.userJwtSecret).toHaveLength(32);
  });

  it('rejects a non-postgres database URL', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'https://example.com/db' })).toThrow('DATABASE_URL');
  });
});
