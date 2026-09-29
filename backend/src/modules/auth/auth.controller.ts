import { Body, Controller, Get, Post, Req } from '@nestjs/common';
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

class GoogleDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  idToken!: string;
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

  @Public()
  @Post('google')
  google(@Body() body: GoogleDto, @Req() request: { ip?: string }) {
    return this.auth.loginWithGoogle(body.idToken, request.ip ?? null);
  }

  @Public()
  @Get('google/client')
  googleClient() {
    return this.auth.publicWebClientId().then((clientId) => ({ clientId }));
  }

  @Public()
  @Post('google/delete-account')
  deleteGoogle(@Body() body: GoogleDto, @Req() request: { ip?: string }) {
    return this.auth.deleteWithGoogle(body.idToken, request.ip ?? null);
  }

  @Public()
  @Post('delete-account')
  deleteAccount(@Body() body: LoginDto, @Req() request: { ip?: string }) {
    return this.auth.deleteAccount(body.email, body.password, request.ip ?? null);
  }
}
