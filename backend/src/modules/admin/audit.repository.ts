import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

export type AuditInput = {
  adminId: string | null;
  action: string;
  provider: string | null;
  success: boolean;
  ipAddress: string | null;
};

@Injectable()
export class AuditRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(input: AuditInput): Promise<void> {
    await this.database.query(
      `INSERT INTO admin_audit_logs (id, admin_id, action, provider, success, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), input.adminId, input.action, input.provider, input.success, input.ipAddress],
    );
  }

  async list(limit: number) {
    const result = await this.database.query<{
      id: string;
      admin_id: string | null;
      action: string;
      provider: string | null;
      success: boolean;
      ip_address: string | null;
      created_at: Date;
    }>(
      `SELECT id, admin_id, action, provider, success, ip_address, created_at
       FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      action: row.action,
      provider: row.provider,
      success: row.success,
      ipAddress: row.ip_address,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
