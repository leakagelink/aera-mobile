import { Injectable } from '@nestjs/common';

import { RedisService } from '../../cache/redis.service';
import { ElevenLabsProvider, voiceError } from '../../providers/elevenlabs.provider';
import { ProviderConfigService } from '../provider-config/provider-config.service';

const MAX_AUDIO_BYTES = 1_500_000;
const MAX_SPEAK_CHARS = 600;

@Injectable()
export class VoiceService {
  constructor(
    private readonly eleven: ElevenLabsProvider,
    private readonly configs: ProviderConfigService,
    private readonly redis: RedisService,
  ) {}

  async transcribe(userId: string, audioBase64: string, mimeType: string): Promise<{ text: string }> {
    await this.limit(userId);
    const audio = decodeAudio(audioBase64);
    const active = await this.requireConfig();
    try {
      const text = await this.eleven.transcribe({
        baseUrl: active.baseUrl,
        apiKey: active.apiKey ?? '',
        audio,
        mimeType,
        timeoutMs: active.timeoutMs,
      });
      await this.redis.addCount('aera:metrics:voice:ok');
      return { text };
    } catch (error) {
      await this.redis.addCount('aera:metrics:voice:error');
      throw error;
    }
  }

  async speak(userId: string, text: string): Promise<{ audioBase64: string }> {
    await this.limit(userId);
    const spoken = text.trim().slice(0, MAX_SPEAK_CHARS);
    if (!spoken) throw voiceError('There is nothing to speak.', 400);
    const active = await this.requireConfig();
    try {
      const bytes = await this.eleven.speak({
        baseUrl: active.baseUrl,
        apiKey: active.apiKey ?? '',
        voiceId: active.model,
        text: spoken,
        timeoutMs: active.timeoutMs,
      });
      await this.redis.addCount('aera:metrics:voice:ok');
      return { audioBase64: Buffer.from(bytes).toString('base64') };
    } catch (error) {
      await this.redis.addCount('aera:metrics:voice:error');
      throw error;
    }
  }

  private async requireConfig() {
    const active = await this.configs.activeElevenLabs();
    if (!active?.enabled || !active.apiKey) throw voiceError('Voice is not configured.', 503);
    return active;
  }

  private async limit(userId: string) {
    const allowed = await this.redis.takeToken(`aera:rl:voice:${userId}`, 10, 60);
    if (!allowed) throw voiceError('Too many voice requests. Try again shortly.', 429);
  }
}

function decodeAudio(audioBase64: string): Uint8Array {
  const cleaned = audioBase64.replace(/\s/g, '');
  if (!cleaned || cleaned.length > Math.ceil(MAX_AUDIO_BYTES * 1.4)) throw voiceError('That recording is too long.', 400);
  const bytes = Buffer.from(cleaned, 'base64');
  if (bytes.byteLength < 100 || bytes.byteLength > MAX_AUDIO_BYTES) throw voiceError('That recording is too long.', 400);
  return bytes;
}
