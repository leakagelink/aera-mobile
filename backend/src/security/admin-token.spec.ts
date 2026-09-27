import { readAdminToken, signAdminToken } from './admin-token';

describe('admin token', () => {
  const secret = 'test-admin-jwt-secret-that-is-long-enough';

  it('accepts a token it just signed', () => {
    const token = signAdminToken({ id: 'admin-1', email: 'admin@example.com' }, secret, 1_000);
    expect(readAdminToken(token, secret, 1_000)).toEqual({ id: 'admin-1', email: 'admin@example.com' });
  });

  it('rejects an expired or altered token', () => {
    const token = signAdminToken({ id: 'admin-1', email: 'admin@example.com' }, secret, 1_000);
    expect(readAdminToken(token, secret, 1_000 + 13 * 60 * 60 * 1000)).toBeNull();
    expect(readAdminToken(`${token}x`, secret, 1_000)).toBeNull();
  });
});
