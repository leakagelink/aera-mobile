import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

import { RedisService } from '../../cache/redis.service';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { DatabaseService } from '../../database/database.service';
import { readGoogleIdToken } from '../../security/google-id-token';
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
    const user = await this.findAccount(email);
    const matches = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH).catch(() => false);
    if (!user?.email || !user.password_hash || !matches) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    return this.session(user.id, user.email);
  }

  async publicWebClientId(): Promise<string | null> {
    return this.webClientId();
  }

  async deleteWithGoogle(idToken: string, ipAddress: string | null) {
    this.assertConfigured();
    await this.limit(ipAddress);
    const audience = await this.webClientId();
    if (!audience) throw new ServiceUnavailableException('Google sign-in is not configured.');
    const profile = await readGoogleIdToken(idToken, audience);
    const linked = await this.database.query<{ id: string }>(
      'SELECT id FROM users WHERE google_sub = $1 AND is_development = false',
      [profile.sub],
    );
    let userId = linked.rows[0]?.id ?? null;
    if (!userId) {
      const byEmail = await this.database.query<{ id: string; google_sub: string | null }>(
        'SELECT id, google_sub FROM users WHERE lower(email) = $1 AND is_development = false',
        [profile.email],
      );
      const existing = byEmail.rows[0];
      if (existing?.google_sub && existing.google_sub !== profile.sub) {
        throw new ConflictException('That email is already linked to another Google account.');
      }
      userId = existing?.id ?? null;
    }
    if (!userId) throw new NotFoundException('No Arah account uses that Google account.');
    const removed = await this.removeAccount(userId);
    if (!removed) throw new NotFoundException('No Arah account uses that Google account.');
    return { deleted: true };
  }

  private async webClientId(): Promise<string | null> {
    const result = await this.database.query<{ web_client_id: string | null }>(
      `SELECT web_client_id FROM google_integration WHERE id = 'default'`,
    );
    return result.rows[0]?.web_client_id ?? null;
  }

  private async findAccount(email: string) {
    const normalized = normalizeEmail(email);
    const result = await this.database.query<{ id: string; email: string; password_hash: string | null }>(
      'SELECT id, email, password_hash FROM users WHERE lower(email) = $1 AND is_development = false',
      [normalized],
    );
    return result.rows[0] ?? null;
  }

  private async removeAccount(userId: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM users WHERE id = $1 AND is_development = false', [userId]);
    return result.rowCount === 1;
  }

  async loginWithGoogle(idToken: string, ipAddress: string | null) {
    this.assertConfigured();
    await this.limit(ipAddress);
    const audience = await this.webClientId();
    if (!audience) throw new ServiceUnavailableException('Google sign-in is not configured.');
    const profile = await readGoogleIdToken(idToken, audience);
    const linked = await this.database.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE google_sub = $1 AND is_development = false',
      [profile.sub],
    );
    if (linked.rows[0]) return this.session(linked.rows[0].id, linked.rows[0].email);
    const byEmail = await this.database.query<{ id: string; email: string; google_sub: string | null }>(
      'SELECT id, email, google_sub FROM users WHERE lower(email) = $1 AND is_development = false',
      [profile.email],
    );
    const existing = byEmail.rows[0];
    if (existing?.google_sub && existing.google_sub !== profile.sub) {
      throw new ConflictException('That email is already linked to another Google account.');
    }
    if (existing) {
      await this.database.query('UPDATE users SET google_sub = $2 WHERE id = $1 AND google_sub IS NULL', [existing.id, profile.sub]);
      return this.session(existing.id, existing.email);
    }
    const id = randomUUID();
    const name = (profile.name || profile.email.split('@')[0] || 'Arah user').slice(0, 80);
    try {
      await this.database.query(
        'INSERT INTO users (id, display_name, is_development, email, google_sub) VALUES ($1, $2, false, $3, $4)',
        [id, name, profile.email, profile.sub],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('An account with that email already exists.');
      throw error;
    }
    return this.session(id, profile.email);
  }

  async deleteAccount(email: string, password: string, ipAddress: string | null) {
    this.assertConfigured();
    await this.limit(ipAddress);
    const user = await this.findAccount(email);
    const matches = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH).catch(() => false);
    if (!user?.id || !user.password_hash || !matches) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    const removed = await this.removeAccount(user.id);
    if (!removed) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    return { deleted: true };
  }

  async deleteSignedInAccount(userId: string) {
    const removed = await this.removeAccount(userId);
    if (!removed) throw new UnauthorizedException('This account cannot be deleted.');
    return { deleted: true };
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
