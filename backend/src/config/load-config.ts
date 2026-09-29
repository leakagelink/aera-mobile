import { currentGeminiModel } from '../providers/gemini-model';
import { DEV_USER_ID } from './constants';

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisUrl: string;
  corsOrigins: string[];
  rateLimitPerMinute: number;
  authMode: 'development' | 'jwt';
  devUserId: string;
  userJwtSecret: string | null;
  trustProxy: boolean;
  geocodingProvider: 'nominatim';
  geocodingBaseUrl: string;
  geocodingUserAgent: string;
  routingProvider: 'osrm';
  routingBaseUrl: string;
  openWeatherApiKey: string | null;
  openWeatherBaseUrl: string;
  geminiApiKey: string | null;
  geminiModel: string;
  tomtomApiKey: string | null;
  aiMaxToolRounds: number;
  aiMaxMessageChars: number;
  aiMaxContextMessages: number;
  aiRateLimitPerMinute: number;
  mapStyleUrl: string | null;
  mapTileBaseUrl: string | null;
  weatherCacheTtlSeconds: number;
  secretEncryptionKey: Buffer | null;
  adminJwtSecret: string | null;
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
  const authMode = readEnum(env.AUTH_MODE, ['development', 'jwt'], 'development');
  const userJwtSecret = readJwtSecret(env.USER_JWT_SECRET, 'USER_JWT_SECRET');
  const adminJwtSecret = readJwtSecret(env.ADMIN_JWT_SECRET, 'ADMIN_JWT_SECRET');
  const secretEncryptionKey = readEncryptionKey(env.AERA_SECRET_ENCRYPTION_KEY);
  if (nodeEnv === 'production') {
    if (authMode !== 'jwt') throw new Error('NODE_ENV=production requires AUTH_MODE=jwt.');
    if (!userJwtSecret) throw new Error('USER_JWT_SECRET is required when NODE_ENV=production.');
    if (!adminJwtSecret) throw new Error('ADMIN_JWT_SECRET is required when NODE_ENV=production.');
    if (!secretEncryptionKey) throw new Error('AERA_SECRET_ENCRYPTION_KEY is required when NODE_ENV=production.');
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
    userJwtSecret,
    trustProxy: env.TRUST_PROXY === 'true',
    geocodingProvider,
    geocodingBaseUrl: trimSlash(readUrl(env.GEOCODING_BASE_URL?.trim() || env.NOMINATIM_BASE_URL, 'https://nominatim.openstreetmap.org', 'GEOCODING_BASE_URL')),
    geocodingUserAgent: env.GEOCODING_USER_AGENT?.trim() || 'ArahBackend/1.0 (https://github.com/leakagelink/aera-mobile)',
    routingProvider,
    routingBaseUrl: trimSlash(readUrl(env.ROUTING_BASE_URL?.trim() || env.OSRM_BASE_URL, 'https://router.project-osrm.org', 'ROUTING_BASE_URL')),
    openWeatherApiKey: readSecret(env.OPENWEATHER_API_KEY),
    openWeatherBaseUrl: trimSlash(readUrl(env.OPENWEATHER_BASE_URL, 'https://api.openweathermap.org', 'OPENWEATHER_BASE_URL')),
    geminiApiKey: readSecret(env.GEMINI_API_KEY),
    geminiModel: currentGeminiModel(env.GEMINI_MODEL),
    aiMaxToolRounds: readRangeInt(env.AI_MAX_TOOL_ROUNDS, 3, 1, 8, 'AI_MAX_TOOL_ROUNDS'),
    aiMaxMessageChars: readRangeInt(env.AI_MAX_MESSAGE_CHARS, 2000, 100, 8000, 'AI_MAX_MESSAGE_CHARS'),
    aiMaxContextMessages: readRangeInt(env.AI_MAX_CONTEXT_MESSAGES, 4, 0, 20, 'AI_MAX_CONTEXT_MESSAGES'),
    aiRateLimitPerMinute: readRangeInt(env.AI_RATE_LIMIT_PER_MINUTE, 12, 1, 120, 'AI_RATE_LIMIT_PER_MINUTE'),
    tomtomApiKey: readSecret(env.TOMTOM_API_KEY),
    mapStyleUrl: readOptionalHttpUrl(env.MAP_STYLE_URL, 'MAP_STYLE_URL'),
    mapTileBaseUrl: readOptionalHttpUrl(env.MAP_TILE_BASE_URL, 'MAP_TILE_BASE_URL'),
    weatherCacheTtlSeconds: readRangeInt(env.WEATHER_CACHE_TTL_SECONDS, 600, 60, 86_400, 'WEATHER_CACHE_TTL_SECONDS'),
    secretEncryptionKey,
    adminJwtSecret,
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

function readSecret(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function readOptionalHttpUrl(value: string | undefined, name: string): string | null {
  if (!value?.trim()) return null;
  return trimSlash(readUrl(value, value, name));
}

function readRangeInt(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} is invalid.`);
  return parsed;
}

function readEncryptionKey(value: string | undefined): Buffer | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const decoded = decodeKey(trimmed);
  if (!decoded || decoded.length !== 32) {
    throw new Error('AERA_SECRET_ENCRYPTION_KEY must be 32 bytes, encoded as base64 or hex.');
  }
  return decoded;
}

function decodeKey(value: string): Buffer | null {
  if (/^[0-9a-f]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  try {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/, '') === value.replace(/=+$/, '')) return decoded;
  } catch {
    return null;
  }
  return null;
}

function readJwtSecret(value: string | undefined, name: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length < 32) throw new Error(`${name} must be at least 32 characters.`);
  return trimmed;
}
