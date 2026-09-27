import { Body, Controller, Post, Req } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

class RegisterDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

class LoginDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  password!: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: RegisterDto, @Req() request: { ip?: string }) {
    return this.auth.register(body.email, body.password, body.displayName, request.ip ?? null);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginDto, @Req() request: { ip?: string }) {
    return this.auth.login(body.email, body.password, request.ip ?? null);
  }
}
