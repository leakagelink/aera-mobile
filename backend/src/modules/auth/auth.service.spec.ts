import { ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';

const secret = 'test-user-jwt-secret-that-is-long-enough';

function service(query: jest.Mock, allowed = true) {
  return new AuthService(
    { query } as never,
    { takeToken: async () => allowed } as never,
    { authMode: 'jwt', userJwtSecret: secret } as never,
  );
}

describe('AuthService', () => {
  it('registers a user and returns a token without the password hash', async () => {
    const query = jest.fn(async () => ({ rows: [] }));
    const result = await service(query).register('Ada@Example.com', 'long-password', 'Ada', '127.0.0.1');
    expect(result.user.email).toBe('ada@example.com');
    expect(result.token.split('.')).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain('long-password');
    const params = (query.mock.calls as unknown[][])[0]?.[1] as unknown[];
    expect(params[2]).toBe('ada@example.com');
    expect(params[3]).not.toBe('long-password');
    expect(await bcrypt.compare('long-password', String(params[3]))).toBe(true);
  });

  it('logs in only the matching account', async () => {
    const hash = await bcrypt.hash('long-password', 4);
    const query = jest.fn(async () => ({ rows: [{ id: 'user-1', email: 'ada@example.com', password_hash: hash }] }));
    await expect(service(query).login('ada@example.com', 'long-password', null)).resolves.toMatchObject({ user: { id: 'user-1' } });
    await expect(service(query).login('ada@example.com', 'wrong-password-value', null)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates a session from a verified Google account', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        aud: '123-web.apps.googleusercontent.com',
        email: 'ada@example.com',
        email_verified: 'true',
        sub: 'google-sub',
        name: 'Ada',
      }),
    } as Response);
    const query = jest.fn(async (sql: string) => {
      if (String(sql).includes('web_client_id')) return { rows: [{ web_client_id: '123-web.apps.googleusercontent.com' }] };
      return { rows: [] };
    });
    await expect(service(query).loginWithGoogle('google-id-token-value-long-enough', null)).resolves.toMatchObject({
      user: { email: 'ada@example.com' },
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), expect.any(Array));
    fetchMock.mockRestore();
  });

  it('deletes an account only after the password matches', async () => {
    const hash = await bcrypt.hash('long-password', 4);
    const query = jest.fn(async (sql: string) => {
      if (String(sql).includes('SELECT')) return { rows: [{ id: 'user-1', email: 'ada@example.com', password_hash: hash }] };
      return { rows: [], rowCount: 1 };
    });
    await expect(service(query).deleteAccount('ada@example.com', 'long-password', null)).resolves.toEqual({ deleted: true });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM users'), ['user-1']);
    await expect(service(query).deleteAccount('ada@example.com', 'wrong-password-value', null)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a duplicate email and a missing configuration', async () => {
    const query = jest.fn(async () => {
      const error = new Error('duplicate') as Error & { code: string };
      error.code = '23505';
      throw error;
    });
    await expect(service(query).register('ada@example.com', 'long-password', undefined, null)).rejects.toBeInstanceOf(ConflictException);
    const closed = new AuthService({ query } as never, { takeToken: async () => true } as never, { authMode: 'development', userJwtSecret: null } as never);
    await expect(closed.login('ada@example.com', 'long-password', null)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
