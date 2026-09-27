import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { AppConfig } from '../../config/load-config';
import { signAdminToken } from '../../security/admin-token';
import { AdminGuard } from './admin.guard';

const secret = 'test-admin-jwt-secret-that-is-long-enough';

function context(token: string | null, admin = true): ExecutionContext {
  const request = { header: () => (token ? `Bearer ${token}` : undefined), headers: {}, admin: undefined as unknown };
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext & { request: typeof request };
}

describe('AdminGuard', () => {
  const reflector = { getAllAndOverride: jest.fn(() => true) };
  const guard = new AdminGuard(reflector as never, { adminJwtSecret: secret } as AppConfig);

  it('rejects a missing session', () => {
    expect(() => guard.canActivate(context(null))).toThrow(UnauthorizedException);
  });

  it('accepts a signed admin token', () => {
    const token = signAdminToken({ id: 'admin-1', email: 'admin@example.com' }, secret);
    const ctx = context(token);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ignores routes that are not admin routes', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);
    expect(guard.canActivate(context(null, false))).toBe(true);
  });
});
