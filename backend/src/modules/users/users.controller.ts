import { Controller, Delete, Get, Req, UnauthorizedException } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { AuthService } from '../auth/auth.service';

@Controller('v1/users')
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Delete('me')
  remove(@Req() request: { user: RequestUser }) {
    if (request.user.developmentOnly) throw new UnauthorizedException('This account cannot be deleted.');
    return this.auth.deleteSignedInAccount(request.user.id);
  }

  @Get('me')
  me(@Req() request: { user: RequestUser }) {
    return {
      id: request.user.id,
      email: request.user.email,
      developmentOnly: request.user.developmentOnly,
      authentication: request.user.developmentOnly ? 'development' : 'jwt',
    };
  }
}
