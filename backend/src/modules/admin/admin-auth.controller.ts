import { Body, Controller, Get, Inject, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { Public } from '../../common/decorators/public.decorator';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { Admin } from './admin.decorator';
import { AdminAuthService } from './admin-auth.service';
import type { AdminRequest } from './admin.guard';

class UpdateAccountDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  currentPassword!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword?: string;
}

class LoginDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

@Controller('v1/admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto, @Req() request: AdminRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body.email, body.password, request.ip ?? null);
    response.cookie('arah_admin', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.nodeEnv === 'production',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    return { ok: true };
  }

  @Admin()
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('arah_admin', { path: '/' });
    return { ok: true };
  }

  @Admin()
  @Get('me')
  me(@Req() request: AdminRequest) {
    return { id: request.admin?.id, email: request.admin?.email };
  }

  @Admin()
  @Patch('me')
  async update(@Body() body: UpdateAccountDto, @Req() request: AdminRequest, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.updateAccount(request.admin?.id ?? '', body.currentPassword, body.email, body.newPassword, request.ip ?? null);
    response.cookie('arah_admin', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.nodeEnv === 'production',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    });
    return { id: result.session.id, email: result.session.email };
  }
}
