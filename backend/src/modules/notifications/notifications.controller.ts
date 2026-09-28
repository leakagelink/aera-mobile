import { Body, Controller, Post, Req } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { NotificationsService } from './notifications.service';

class RegisterDeviceDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token!: string;

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}

@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('device')
  register(@Req() request: { user: RequestUser }, @Body() body: RegisterDeviceDto) {
    return this.notifications.register(request.user.id, body.token, body.platform);
  }
}
