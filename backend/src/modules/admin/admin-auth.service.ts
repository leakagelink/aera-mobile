import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { RedisService } from '../../cache/redis.service';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { DatabaseService } from '../../database/database.service';
import { signAdminToken, type AdminSession } from '../../security/admin-token';
import { AuditRepository } from './audit.repository';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly audit: AuditRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(email: string, password: string, ipAddress: string | null): Promise<{ token: string; session: AdminSession }> {
    if (!this.config.adminJwtSecret) {
      throw new UnauthorizedException('Admin authentication is not configured.');
    }
    const allowed = await this.redis.takeToken(`aera:rl:admin-login:${ipAddress ?? 'unknown'}`, 10, 15 * 60);
    if (!allowed) throw new UnauthorizedException('Too many login attempts. Try again shortly.');
    const normalized = email.trim().toLowerCase();
    const result = await this.database.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM admin_users WHERE email = $1',
      [normalized],
    );
    const admin = result.rows[0];
    const hash = admin?.password_hash ?? '$2b$04$dpKW1VDs/kibVhxS9./UOOih3tPT5oiiRNRPyYmjEjVLeaJ/.iFGq';
    const matches = await bcrypt.compare(password, hash).catch(() => false);
    if (!admin || !matches) {
      await this.audit.insert({ adminId: null, action: 'Admin login failed', provider: null, success: false, ipAddress });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    const session = { id: admin.id, email: admin.email };
    await this.audit.insert({ adminId: admin.id, action: 'Admin login succeeded', provider: null, success: true, ipAddress });
    return { token: signAdminToken(session, this.config.adminJwtSecret), session };
  }
}
