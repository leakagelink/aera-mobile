import { readUserToken, signUserToken } from './user-token';
import { readAdminToken, signAdminToken } from './admin-token';

describe('user token', () => {
  const userSecret = 'test-user-jwt-secret-that-is-long-enough';
  const adminSecret = 'test-admin-jwt-secret-that-is-long-enough';

  it('accepts a user token and rejects an admin token signed with the same secret', () => {
    const token = signUserToken({ id: 'user-1', email: 'ada@example.com' }, userSecret, 1_000);
    expect(readUserToken(token, userSecret, 1_000)).toEqual({ id: 'user-1', email: 'ada@example.com' });
    const admin = signAdminToken({ id: 'admin-1', email: 'admin@example.com' }, userSecret, 1_000);
    expect(readUserToken(admin, userSecret, 1_000)).toBeNull();
    expect(readAdminToken(token, userSecret, 1_000)).toBeNull();
  });

  it('rejects an expired user token', () => {
    const token = signUserToken({ id: 'user-1', email: 'ada@example.com' }, userSecret, 1_000);
    expect(readUserToken(token, userSecret, 1_000 + 31 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(readUserToken(token, adminSecret, 1_000)).toBeNull();
  });
});
