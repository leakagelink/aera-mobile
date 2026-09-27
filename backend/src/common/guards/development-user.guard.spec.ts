import { UnauthorizedException } from '@nestjs/common';

import { DevelopmentUserGuard } from './development-user.guard';
import { signUserToken } from '../../security/user-token';

const secret = 'test-user-jwt-secret-that-is-long-enough';

function context(headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; user?: unknown } = { headers };
  return {
    request,
    context: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    },
  };
}

describe('DevelopmentUserGuard', () => {
  it('keeps the development user outside production', () => {
    const guard = new DevelopmentUserGuard({ getAllAndOverride: () => false } as never, { nodeEnv: 'development', authMode: 'development', devUserId: '00000000-0000-4000-8000-000000000001', userJwtSecret: null } as never);
    const { request, context: ctx } = context();
    expect(guard.canActivate(ctx as never)).toBe(true);
    expect(request.user).toEqual({ id: '00000000-0000-4000-8000-000000000001', email: null, developmentOnly: true });
  });

  it('requires a user token in jwt mode and ignores a caller-supplied user id', () => {
    const guard = new DevelopmentUserGuard({ getAllAndOverride: () => false } as never, { nodeEnv: 'production', authMode: 'jwt', devUserId: '00000000-0000-4000-8000-000000000001', userJwtSecret: secret } as never);
    const token = signUserToken({ id: '11111111-1111-4111-8111-111111111111', email: 'ada@example.com' }, secret, Date.now());
    expect(() => guard.canActivate(context().context as never)).toThrow(UnauthorizedException);
    const { request, context: ctx } = context({ authorization: `Bearer ${token}` });
    expect(guard.canActivate(ctx as never)).toBe(true);
    expect(request.user).toEqual({ id: '11111111-1111-4111-8111-111111111111', email: 'ada@example.com', developmentOnly: false });
  });
});
