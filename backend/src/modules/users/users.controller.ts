import { Controller, Get, Req } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';

@Controller('v1/users')
export class UsersController {
  @Get('me')
  me(@Req() request: { user: RequestUser }) {
    return {
      id: request.user.id,
      developmentOnly: true,
      authentication: 'not_configured',
    };
  }
}
