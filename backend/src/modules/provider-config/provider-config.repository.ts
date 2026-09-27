import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import type { ProviderType } from '../../providers/catalog';

export type ProviderRow = {
  id: string;
  provider: string;
  provider_type: ProviderType;
  name: string;
  base_url: string;
  api_key_encrypted: string | null;
  api_key_last4: string | null;
  model: string | null;
  enabled: boolean;
  is_default: boolean;
  timeout_ms: number;
  config_json: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  last_tested_at: Date | null;
  last_test_status: 'success' | 'failure' | null;
  last_test_message: string | null;
  last_test_latency_ms: number | null;
  last_success_at: Date | null;
};

export type ProviderInsert = {
  id: string;
  provider: string;
  providerType: ProviderType;
  name: string;
  baseUrl: string;
  apiKeyEncrypted: string | null;
  apiKeyLast4: string | null;
  model: string | null;
  enabled: boolean;
  isDefault: boolean;
  timeoutMs: number;
  configJson: Record<string, unknown>;
};

@Injectable()
export class ProviderConfigRepository {
  constructor(private readonly database: DatabaseService) {}

  async list(): Promise<ProviderRow[]> {
    const result = await this.database.query<ProviderRow>(`${selectSql} ORDER BY provider_type, name`);
    return result.rows;
  }

  async findById(id: string): Promise<ProviderRow | null> {
    const result = await this.database.query<ProviderRow>(`${selectSql} WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async findByProvider(provider: string): Promise<ProviderRow | null> {
    const result = await this.database.query<ProviderRow>(`${selectSql} WHERE provider = $1`, [provider]);
    return result.rows[0] ?? null;
  }

  async findPreferred(providerType: ProviderType): Promise<ProviderRow | null> {
    const result = await this.database.query<ProviderRow>(
      `${selectSql} WHERE provider_type = $1 ORDER BY is_default DESC, enabled DESC, updated_at DESC LIMIT 1`,
      [providerType],
    );
    return result.rows[0] ?? null;
  }

  async findActive(providerType: ProviderType): Promise<ProviderRow | null> {
    const result = await this.database.query<ProviderRow>(
      `${selectSql} WHERE provider_type = $1 AND enabled = true ORDER BY is_default DESC, updated_at DESC LIMIT 1`,
      [providerType],
    );
    return result.rows[0] ?? null;
  }

  async insert(input: ProviderInsert): Promise<void> {
    await this.database.query(
      `INSERT INTO provider_configs (
         id, provider, provider_type, name, base_url, api_key_encrypted, api_key_last4, model,
         enabled, is_default, timeout_ms, config_json
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
        input.id,
        input.provider,
        input.providerType,
        input.name,
        input.baseUrl,
        input.apiKeyEncrypted,
        input.apiKeyLast4,
        input.model,
        input.enabled,
        input.isDefault,
        input.timeoutMs,
        JSON.stringify(input.configJson),
      ],
    );
  }

  async update(id: string, input: Omit<ProviderInsert, 'id' | 'provider' | 'providerType'>): Promise<void> {
    await this.database.query(
      `UPDATE provider_configs SET
         name = $2, base_url = $3, api_key_encrypted = $4, api_key_last4 = $5, model = $6,
         enabled = $7, is_default = $8, timeout_ms = $9, config_json = $10::jsonb, updated_at = now()
       WHERE id = $1`,
      [id, input.name, input.baseUrl, input.apiKeyEncrypted, input.apiKeyLast4, input.model, input.enabled, input.isDefault, input.timeoutMs, JSON.stringify(input.configJson)],
    );
  }

  async clearDefault(providerType: ProviderType, exceptId: string): Promise<void> {
    await this.database.query(`UPDATE provider_configs SET is_default = false, updated_at = now() WHERE provider_type = $1 AND id <> $2 AND is_default = true`, [
      providerType,
      exceptId,
    ]);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM provider_configs WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async markTest(id: string, input: { status: 'success' | 'failure'; message: string; latencyMs: number; makeDefault: boolean }): Promise<void> {
    await this.database.withTransaction(async (query) => {
      const current = await query<{ provider_type: ProviderType }>(`SELECT provider_type FROM provider_configs WHERE id = $1`, [id]);
      const providerType = current.rows[0]?.provider_type;
      if (!providerType) return;
      if (input.makeDefault) {
        await query(`UPDATE provider_configs SET is_default = false, updated_at = now() WHERE provider_type = $1 AND id <> $2`, [providerType, id]);
      }
      await query(
        `UPDATE provider_configs SET
           last_tested_at = now(),
           last_test_status = $2,
           last_test_message = $3,
           last_test_latency_ms = $4,
           last_success_at = CASE WHEN $2 = 'success' THEN now() ELSE last_success_at END,
           is_default = CASE WHEN $5 THEN true ELSE is_default END,
           updated_at = now()
         WHERE id = $1`,
        [id, input.status, input.message, input.latencyMs, input.makeDefault],
      );
    });
  }
}

const selectSql = `
  SELECT id, provider, provider_type, name, base_url, api_key_encrypted, api_key_last4, model,
         enabled, is_default, timeout_ms, config_json, created_at, updated_at, last_tested_at,
         last_test_status, last_test_message, last_test_latency_ms, last_success_at
  FROM provider_configs
`;
