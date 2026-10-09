import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';

import type { RequestUser } from '../../common/guards/development-user.guard';
import { AiService } from './ai.service';
import { ChatDto, SpeakDto, TranscribeDto } from './dto';
import { VoiceService } from './voice.service';

@Controller('v1/ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly voice: VoiceService,
  ) {}

  @Post('chat')
  chat(@Req() request: { user: RequestUser }, @Body() body: ChatDto) {
    return this.ai.chat(request.user.id, body);
  }

  @Get('memory')
  memory(@Req() request: { user: RequestUser }) {
    return this.ai.memory(request.user.id);
  }

  @Delete('memory')
  clearMemory(@Req() request: { user: RequestUser }) {
    return this.ai.clearMemory(request.user.id);
  }

  @Post('speech/transcribe')
  transcribe(@Req() request: { user: RequestUser }, @Body() body: TranscribeDto) {
    return this.voice.transcribe(request.user.id, body.audioBase64, body.mimeType ?? 'audio/mp4');
  }

  @Post('speech/speak')
  speak(@Req() request: { user: RequestUser }, @Body() body: SpeakDto) {
    return this.voice.speak(request.user.id, body.text);
  }
}
