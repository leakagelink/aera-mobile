import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import type { AppConfig } from '../../config/load-config';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  const secret = 'test-admin-jwt-secret-that-is-long-enough';

  async function service(user: { id: string; email: string; password_hash: string } | null) {
    const database = { query: jest.fn(async () => ({ rows: user ? [user] : [] })) };
    const redis = { takeToken: jest.fn(async () => true) };
    const audit = { insert: jest.fn(async () => undefined) };
    const config = { adminJwtSecret: secret } as AppConfig;
    return { auth: new AdminAuthService(database as never, redis as never, audit as never, config), audit };
  }

  it('returns a generic error when the email is unknown', async () => {
    const { auth, audit } = await service(null);
    await expect(auth.login('missing@example.com', 'not-the-password', '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'Admin login failed', success: false }));
    expect(JSON.stringify(audit.insert.mock.calls)).not.toContain('not-the-password');
  });

  it('signs in with a matching password and does not audit the password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const { auth, audit } = await service({ id: 'admin-1', email: 'admin@example.com', password_hash: passwordHash });
    const result = await auth.login('admin@example.com', 'correct-password', '127.0.0.1');
    expect(result.session.email).toBe('admin@example.com');
    expect(result.token.split('.')).toHaveLength(3);
    expect(JSON.stringify(audit.insert.mock.calls)).not.toContain('correct-password');
  });
});
