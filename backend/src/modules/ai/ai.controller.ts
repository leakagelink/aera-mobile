import { Body, Controller, Post, Req } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { AiService } from './ai.service';
import { ChatDto } from './dto';

@Controller('v1/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('chat')
  chat(@Req() request: { user: RequestUser }, @Body() body: ChatDto) {
    return this.ai.chat(request.user.id, body);
  }
}
