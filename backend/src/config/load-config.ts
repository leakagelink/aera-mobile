import { DEV_USER_ID } from './constants';

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  corsOrigins: string[];
  rateLimitPerMinute: number;
  authMode: 'development';
  devUserId: string;
  trustProxy: boolean;
  geocodingProvider: 'nominatim';
  geocodingBaseUrl: string;
  geocodingUserAgent: string;
  routingProvider: 'osrm';
  routingBaseUrl: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const nodeEnv = readEnum(env.NODE_ENV, ['development', 'test', 'production'], 'development');
  const databaseUrl = required(env.DATABASE_URL, 'DATABASE_URL');
  const redisUrl = required(env.REDIS_URL, 'REDIS_URL');
  assertUrl(databaseUrl, 'DATABASE_URL');
  assertUrl(redisUrl, 'REDIS_URL');
  const geocodingProvider = readEnum(env.GEOCODING_PROVIDER, ['nominatim'], 'nominatim');
  const routingProvider = readEnum(env.ROUTING_PROVIDER, ['osrm'], 'osrm');
  const authMode = readEnum(env.AUTH_MODE, ['development'], 'development');
  if (nodeEnv === 'production') {
    throw new Error('AUTH_MODE=development cannot be used when NODE_ENV=production.');
  }
  const devUserId = (env.DEV_USER_ID?.trim() || DEV_USER_ID).toLowerCase();
  if (!UUID.test(devUserId)) {
    throw new Error('DEV_USER_ID must be a UUID.');
  }
  return {
    nodeEnv,
    port: readPort(env.PORT),
    databaseUrl,
    redisUrl,
    corsOrigins: readList(env.CORS_ORIGINS, ['http://localhost:8081']),
    rateLimitPerMinute: readPositiveInt(env.RATE_LIMIT_PER_MINUTE, 60),
    authMode,
    devUserId,
    trustProxy: env.TRUST_PROXY === 'true',
    geocodingProvider,
    geocodingBaseUrl: trimSlash(readUrl(env.GEOCODING_BASE_URL, 'https://nominatim.openstreetmap.org', 'GEOCODING_BASE_URL')),
    geocodingUserAgent: env.GEOCODING_USER_AGENT?.trim() || 'ArahBackend/1.0 (https://github.com/leakagelink/aera-mobile)',
    routingProvider,
    routingBaseUrl: trimSlash(readUrl(env.ROUTING_BASE_URL, 'https://router.project-osrm.org', 'ROUTING_BASE_URL')),
  };
}

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} is required.`);
  return trimmed;
}

function assertUrl(value: string, name: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:' && url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
      if (name === 'DATABASE_URL' && url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
        throw new Error('bad protocol');
      }
    }
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (name === 'DATABASE_URL' && !value.startsWith('postgres')) {
    throw new Error('DATABASE_URL must be a postgres URL.');
  }
  if (name === 'REDIS_URL' && !value.startsWith('redis')) {
    throw new Error('REDIS_URL must be a redis URL.');
  }
}

function readUrl(value: string | undefined, fallback: string, name: string): string {
  const trimmed = value?.trim() || fallback;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
    return url.toString();
  } catch {
    throw new Error(`${name} must be an http(s) URL.`);
  }
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid.');
  return port;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) throw new Error('RATE_LIMIT_PER_MINUTE is invalid.');
  return parsed;
}

function readList(value: string | undefined, fallback: string[]): string[] {
  const items = (value?.trim() ? value.split(',') : fallback).map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) throw new Error('CORS_ORIGINS is empty.');
  return items;
}

function readEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const selected = (value?.trim() || fallback) as T;
  if (!allowed.includes(selected)) {
    throw new Error(`Unsupported value "${selected}". Expected ${allowed.join(' or ')}.`);
  }
  return selected;
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}
