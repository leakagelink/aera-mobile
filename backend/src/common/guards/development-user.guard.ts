import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC } from '../decorators/public.decorator';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';

export type RequestUser = {
  id: string;
  developmentOnly: true;
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
    if (this.config.nodeEnv === 'production' || this.config.authMode !== 'development') {
      throw new UnauthorizedException('Authentication is not configured.');
    }
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    request.user = { id: this.config.devUserId, developmentOnly: true };
    return true;
  }
}
