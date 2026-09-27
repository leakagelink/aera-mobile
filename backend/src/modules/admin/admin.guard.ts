import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { readAdminToken, readCookie, type AdminSession } from '../../security/admin-token';
import { IS_ADMIN } from './admin.decorator';

export type AdminRequest = Request & { admin?: AdminSession };

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isAdmin = this.reflector.getAllAndOverride<boolean>(IS_ADMIN, [context.getHandler(), context.getClass()]);
    if (!isAdmin) return true;
    if (!this.config.adminJwtSecret) throw new UnauthorizedException('Admin authentication is not configured.');
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const header = request.header('authorization');
    const bearer = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
    const token = bearer || readCookie(request.headers.cookie, 'arah_admin');
    if (!token) throw new UnauthorizedException('Admin authentication is required.');
    const session = readAdminToken(token, this.config.adminJwtSecret);
    if (!session) throw new UnauthorizedException('Admin authentication is required.');
    request.admin = session;
    return true;
  }
}
