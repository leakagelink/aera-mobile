import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

import { RedisService } from '../../cache/redis.service';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { DatabaseService } from '../../database/database.service';
import { signUserToken } from '../../security/user-token';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';
const DUMMY_HASH = '$2b$04$dpKW1VDs/kibVhxS9./UOOih3tPT5oiiRNRPyYmjEjVLeaJ/.iFGq';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(email: string, password: string, displayName: string | undefined, ipAddress: string | null) {
    this.assertConfigured();
    await this.limit(ipAddress);
    const normalized = normalizeEmail(email);
    const name = displayName?.trim() || normalized.split('@')[0] || 'Arah user';
    const hash = await bcrypt.hash(password, 12);
    const id = randomUUID();
    try {
      await this.database.query(
        `INSERT INTO users (id, display_name, is_development, email, password_hash) VALUES ($1, $2, false, $3, $4)`,
        [id, name.slice(0, 80), normalized, hash],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('An account with that email already exists.');
      throw error;
    }
    return this.session(id, normalized);
  }

  async login(email: string, password: string, ipAddress: string | null) {
    this.assertConfigured();
    await this.limit(ipAddress);
    const normalized = normalizeEmail(email);
    const result = await this.database.query<{ id: string; email: string; password_hash: string | null }>(
      'SELECT id, email, password_hash FROM users WHERE lower(email) = $1 AND is_development = false',
      [normalized],
    );
    const user = result.rows[0];
    const matches = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH).catch(() => false);
    if (!user?.email || !user.password_hash || !matches) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    return this.session(user.id, user.email);
  }

  private session(id: string, email: string) {
    if (!this.config.userJwtSecret) throw new UnauthorizedException('Sign-in is not configured.');
    return {
      token: signUserToken({ id, email }, this.config.userJwtSecret),
      user: { id, email },
    };
  }

  private assertConfigured(): void {
    if (this.config.authMode !== 'jwt' || !this.config.userJwtSecret) {
      throw new UnauthorizedException('Sign-in is not configured.');
    }
  }

  private async limit(ipAddress: string | null): Promise<void> {
    const allowed = await this.redis.takeToken(`aera:rl:user-auth:${ipAddress ?? 'unknown'}`, 10, 15 * 60);
    if (!allowed) throw new UnauthorizedException('Too many sign-in attempts. Try again shortly.');
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === '23505');
}
