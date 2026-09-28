import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../../cache/redis.service';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { GeminiProvider, aiError, type GeminiContent, type GeminiFunctionCall, type GeminiTurn } from '../../providers/gemini.provider';
import { ProviderConfigService } from '../provider-config/provider-config.service';
import { ArahToolRegistry, type AiClientContext, type ToolActivity } from './tool-registry';

const SYSTEM = [
  'You are Arah, a navigation assistant. Speak briefly and plainly.',
  'Never invent location, GPS, speed, traffic, weather, routes, ETA, or trip history.',
  'When a question needs real Arah data, call a registered tool and answer only from its result.',
  'If a tool result contains a code such as LOCATION_UNAVAILABLE, say that information is unavailable.',
  'Do not mention providers, API keys, SQL, or internal errors.',
  'Routing cannot avoid tolls or highways. If a result says not_supported, tell the user those constraints were not applied.',
].join(' ');

@Injectable()
export class AiService {
  constructor(
    private readonly gemini: GeminiProvider,
    private readonly tools: ArahToolRegistry,
    private readonly configs: ProviderConfigService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async chat(userId: string, input: { message: string; history?: { role: 'user' | 'assistant'; text: string }[]; context?: AiClientContext }) {
    const message = input.message.trim();
    if (!message || message.length > this.config.aiMaxMessageChars) {
      throw aiError('AI_MESSAGE_TOO_LARGE', 'That message is too long.', 400);
    }
    const allowed = await this.redis.takeToken(`aera:rl:ai:${userId}`, this.config.aiRateLimitPerMinute, 60);
    if (!allowed) throw aiError('AI_RATE_LIMITED', 'Too many assistant requests. Try again shortly.', 429);
    const resolved = await this.configs.activeGemini();
    if (!resolved?.enabled || !resolved.apiKey) throw aiError('GEMINI_NOT_CONFIGURED', 'The assistant is not configured.', 503);

    const contents = this.contents(input.history ?? [], message);
    const declarations = this.tools.declarations();
    const toolCalls: ToolActivity[] = [];
    const counts = new Map<string, number>();
    let rejected = 0;

    for (let round = 0; round < this.config.aiMaxToolRounds; round += 1) {
      const turn = await this.gemini.generate({
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        model: resolved.model,
        timeoutMs: resolved.timeoutMs,
        system: SYSTEM,
        contents,
        tools: declarations,
      });
      if (turn.functionCalls.length === 0) {
        return { message: turn.text ?? 'I could not answer that from the available Arah data.', toolCalls };
      }
      const calls = turn.functionCalls.slice(0, 3);
      const responses: Record<string, unknown>[] = [];
      for (const call of calls) {
        const seen = (counts.get(call.name) ?? 0) + 1;
        counts.set(call.name, seen);
        if (seen > 3) {
          return { message: 'I stopped before repeating the same lookup.', toolCalls };
        }
        const executed = await this.tools.execute(call.name, call.args, { userId, ...input.context });
        toolCalls.push(executed.activity);
        if (executed.activity.status === 'rejected') rejected += 1;
        if (rejected >= 2) {
          return { message: 'I could not complete that request with the available Arah tools.', toolCalls };
        }
        responses.push({
          functionResponse: {
            name: call.name,
            ...(call.id ? { id: call.id } : {}),
            response: executed.result,
          },
        });
      }
      contents.push({ role: 'model', parts: modelPartsFor(turn, calls) });
      contents.push({
        role: 'user',
        parts: responses,
      });
    }
    return { message: 'I could not finish that request within the lookup limit.', toolCalls };
  }

  private contents(history: { role: 'user' | 'assistant'; text: string }[], message: string): GeminiContent[] {
    const prior = history
      .slice(-this.config.aiMaxContextMessages)
      .flatMap((entry) => {
        const text = entry.text.trim().slice(0, 500);
        if (!text || (entry.role !== 'user' && entry.role !== 'assistant')) return [];
        return [{ role: entry.role === 'assistant' ? ('model' as const) : ('user' as const), parts: [{ text }] }];
      });
    return [...prior, { role: 'user', parts: [{ text: message }] }];
  }
}

function modelPartsFor(turn: GeminiTurn, calls: GeminiFunctionCall[]): Record<string, unknown>[] {
  const raw = turn.modelParts ?? [];
  const functionParts = raw.filter((part) => 'functionCall' in part);
  if (functionParts.length > 0 && functionParts.length <= calls.length) return raw;
  if (functionParts.length > calls.length) {
    let kept = 0;
    return raw.filter((part) => {
      if (!('functionCall' in part)) return true;
      kept += 1;
      return kept <= calls.length;
    });
  }
  return calls.map((call) => ({ functionCall: { name: call.name, args: call.args, ...(call.id ? { id: call.id } : {}) } }));
}
