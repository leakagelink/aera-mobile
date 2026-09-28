import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../../database/database.service';
import { GoogleIntegrationService } from '../admin/google-integration.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly google: GoogleIntegrationService,
  ) {}

  async register(userId: string, token: string, platform: string) {
    const inserted = await this.database.query<{ id: string }>(
      `INSERT INTO device_push_tokens (id, user_id, token, platform)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO NOTHING
       RETURNING id`,
      [randomUUID(), userId, token, platform],
    );
    if (inserted.rows.length === 0) {
      await this.database.query('UPDATE device_push_tokens SET user_id = $2, platform = $3, updated_at = now() WHERE token = $1', [
        token,
        userId,
        platform,
      ]);
      return { registered: true };
    }
    await this.google.sendPush(token, 'Arah', 'Notifications are on for this phone.');
    return { registered: true };
  }
}
