import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/load-config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  onModuleInit(): void {
    this.client = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    this.client.on('error', () => {
      this.logger.warn(JSON.stringify({ event: 'redis_error' }));
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
    this.client = null;
  }

  async ping(): Promise<boolean> {
    try {
      await this.connect();
      return (await this.client?.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.connect();
      return (await this.client?.get(key)) ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.connect();
      await this.client?.set(key, value, 'EX', ttlSeconds);
    } catch {
      this.logger.warn(JSON.stringify({ event: 'redis_cache_write_failed' }));
    }
  }

  async takeToken(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
      await this.connect();
      if (!this.client) return true;
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, windowSeconds);
      return count <= limit;
    } catch {
      this.logger.warn(JSON.stringify({ event: 'rate_limit_unavailable' }));
      return true;
    }
  }

  private async connect(): Promise<void> {
    if (this.client && this.client.status === 'wait') await this.client.connect();
  }
}
