import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../../cache/redis.service';
import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { GeminiProvider, aiError, type GeminiContent, type GeminiFunctionCall, type GeminiTurn } from '../../providers/gemini.provider';
import { RelayProvider, isRelayFallbackError } from '../../providers/relay.provider';
import { ProviderConfigService } from '../provider-config/provider-config.service';
import { cardsFromToolResult, type AiCard } from './ai-cards';
import { aiMemoryKey, appendMemory, parseMemory, type StoredTurn } from './memory';
import { ArahToolRegistry, type AiClientContext, type ToolActivity } from './tool-registry';

const SYSTEM = [
  'You are Arah, a friendly navigation companion. You are not a person and you do not have human feelings.',
  'Reply in the user\'s language. Hindi, Hinglish, English, and other Indian languages are welcome. Keep place names and addresses exactly as the tools return them.',
  'Casual conversation can be warm and brief: two or three short sentences, plus one follow-up when it helps.',
  'For location, places, routes, ETA, speed, weather, traffic, or trips, call a tool and use only that result. Never invent those facts.',
  'If a tool result contains a code, say that information is unavailable.',
  'Do not mention providers, API keys, SQL, or internal errors.',
  'Routing cannot avoid tolls or highways. If a result says not_supported, tell the user those constraints were not applied.',
].join(' ');

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
};

@Injectable()
export class AiService {
  constructor(
    private readonly gemini: GeminiProvider,
    private readonly relay: RelayProvider,
    private readonly tools: ArahToolRegistry,
    private readonly configs: ProviderConfigService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async chat(userId: string, input: { message: string; history?: { role: 'user' | 'assistant'; text: string }[]; context?: AiClientContext; language?: string; remember?: boolean }) {
    const message = input.message.trim();
    if (!message || message.length > this.config.aiMaxMessageChars) {
      throw aiError('AI_MESSAGE_TOO_LARGE', 'That message is too long.', 400);
    }
    const allowed = await this.redis.takeToken(`aera:rl:ai:${userId}`, this.config.aiRateLimitPerMinute, 60);
    if (!allowed) throw aiError('AI_RATE_LIMITED', 'Too many assistant requests. Try again shortly.', 429);
    const gemini = await this.configs.activeGemini();
    const relay = await this.configs.activeRelay();
    const geminiConfig = gemini?.enabled && gemini.apiKey ? gemini : null;
    const relayConfig = relay?.enabled && relay.apiKey ? relay : null;
    if (!geminiConfig && !relayConfig) throw aiError('GEMINI_NOT_CONFIGURED', 'The assistant is not configured.', 503);

    const contents = this.contents(input.history ?? [], message);
    const declarations = this.tools.declarations();
    const toolCalls: ToolActivity[] = [];
    const cards: AiCard[] = [];
    const counts = new Map<string, number>();
    let rejected = 0;
    let useRelay = !geminiConfig;

    for (let round = 0; round < this.config.aiMaxToolRounds; round += 1) {
      const request = {
        system: this.system(input.language),
        contents,
        tools: declarations,
      };
      const speak = async (kind: 'gemini' | 'relay') => {
        const active = kind === 'relay' ? relayConfig : geminiConfig;
        if (!active?.apiKey) throw aiError('GEMINI_NOT_CONFIGURED', 'The assistant is not configured.', 503);
        const payload = { ...request, baseUrl: active.baseUrl, apiKey: active.apiKey, model: active.model, timeoutMs: active.timeoutMs };
        return kind === 'relay' ? this.relay.generate(payload) : this.gemini.generate(payload);
      };
      let turn: GeminiTurn;
      try {
        turn = await speak(useRelay ? 'relay' : 'gemini');
      } catch (error) {
        if (useRelay || !relayConfig || !isRelayFallbackError(error)) throw error;
        useRelay = true;
        turn = await speak('relay');
      }
      if (turn.functionCalls.length === 0) {
        const messageText = turn.text ?? 'I could not answer that from the available Arah data.';
        await this.finish(userId, input, messageText, true);
        return { message: messageText, toolCalls, cards };
      }
      const calls = turn.functionCalls.slice(0, 3);
      const responses: Record<string, unknown>[] = [];
      for (const call of calls) {
        const seen = (counts.get(call.name) ?? 0) + 1;
        counts.set(call.name, seen);
        if (seen > 3) {
          const repeated = 'I stopped before repeating the same lookup.';
          await this.finish(userId, input, repeated, false);
          return { message: repeated, toolCalls, cards };
        }
        const executed = await this.tools.execute(call.name, call.args, { userId, ...input.context });
        toolCalls.push(executed.activity);
        cards.push(...cardsFromToolResult(executed.result));
        if (executed.activity.status === 'rejected') rejected += 1;
        if (rejected >= 2) {
          const rejectedMessage = 'I could not complete that request with the available Arah tools.';
          await this.finish(userId, input, rejectedMessage, false);
          return { message: rejectedMessage, toolCalls, cards };
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
    const unfinished = 'I could not finish that request within the lookup limit.';
    await this.finish(userId, input, unfinished, false);
    return { message: unfinished, toolCalls, cards };
  }

  async memory(userId: string): Promise<{ messages: StoredTurn[] }> {
    return { messages: parseMemory(await this.redis.get(aiMemoryKey(userId))) };
  }

  async clearMemory(userId: string): Promise<{ deleted: true }> {
    await this.redis.delete(aiMemoryKey(userId));
    return { deleted: true };
  }

  private async finish(userId: string, input: { message: string; remember?: boolean }, answer: string, success: boolean) {
    await this.redis.addCount(success ? 'aera:metrics:ai:ok' : 'aera:metrics:ai:error');
    if (!input.remember) return;
    const current = parseMemory(await this.redis.get(aiMemoryKey(userId)));
    const next = appendMemory(current, [
      { role: 'user', text: input.message },
      { role: 'assistant', text: answer },
    ]);
    await this.redis.set(aiMemoryKey(userId), JSON.stringify(next), 60 * 60 * 24 * 30);
  }

  private system(language?: string): string {
    const name = language ? LANGUAGE_NAMES[language] : undefined;
    if (!name) return SYSTEM;
    return `${SYSTEM} The user chose ${name}. Reply in ${name}.`;
  }

  private contents(history: { role: 'user' | 'assistant'; text: string }[], message: string): GeminiContent[] {
    const prior = history
      .slice(-this.config.aiMaxContextMessages)
      .flatMap((entry) => {
        const text = entry.text.trim().slice(0, 320);
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
