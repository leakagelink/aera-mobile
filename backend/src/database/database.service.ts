import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

import { APP_CONFIG } from '../config/config.module';
import type { AppConfig } from '../config/load-config';
import { migrate } from './migrate';

export type Sql = <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({ connectionString: this.config.databaseUrl, max: 10 });
    await migrate(this.pool);
    if (this.config.authMode === 'development') {
      await this.pool.query(
        `INSERT INTO users (id, display_name, is_development)
         VALUES ($1, 'Development user', true)
         ON CONFLICT (id) DO NOTHING`,
        [this.config.devUserId],
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error('Database is not connected.');
    return this.pool.query<T>(sql, params);
  }

  async withTransaction<T>(fn: (query: Sql) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('Database is not connected.');
    const client = await this.pool.connect();
    const query: Sql = (sql, params = []) => client.query(sql, params);
    try {
      await client.query('BEGIN');
      const result = await fn(query);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.query<{ ok: string }>('SELECT PostGIS_Version() AS ok');
      return Boolean(result.rows[0]?.ok);
    } catch {
      return false;
    }
  }
}
