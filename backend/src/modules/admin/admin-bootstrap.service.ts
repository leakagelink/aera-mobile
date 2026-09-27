import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.nodeEnv === 'test') return;
    const existing = await this.database.query<{ count: string }>('SELECT count(*)::text AS count FROM admin_users');
    if (Number(existing.rows[0]?.count ?? 0) > 0) return;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD?.trim();
    const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
    if (!email || (!password && !passwordHash)) return;
    const hash = passwordHash || (await bcrypt.hash(password ?? '', 12));
    await this.database.query(`INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3)`, [crypto.randomUUID(), email, hash]);
    this.logger.log(JSON.stringify({ event: 'admin_bootstrapped' }));
  }
}
