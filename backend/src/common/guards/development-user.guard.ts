import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_ADMIN } from '../../modules/admin/admin.decorator';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { readUserToken } from '../../security/user-token';

export type RequestUser = {
  id: string;
  email: string | null;
  developmentOnly: boolean;
};

@Injectable()
export class DevelopmentUserGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const isAdmin = this.reflector.getAllAndOverride<boolean>(IS_ADMIN, [context.getHandler(), context.getClass()]);
    if (isAdmin) return true;
    const request = context.switchToHttp().getRequest<{ user?: RequestUser; headers?: { authorization?: string } }>();
    if (this.config.authMode === 'development' && this.config.nodeEnv !== 'production') {
      request.user = { id: this.config.devUserId, email: null, developmentOnly: true };
      return true;
    }
    if (!this.config.userJwtSecret) throw new UnauthorizedException('Authentication is not configured.');
    const header = request.headers?.authorization;
    const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    const session = token ? readUserToken(token, this.config.userJwtSecret) : null;
    if (!session) throw new UnauthorizedException('Sign in to continue.');
    request.user = { id: session.id, email: session.email, developmentOnly: false };
    return true;
  }
}
