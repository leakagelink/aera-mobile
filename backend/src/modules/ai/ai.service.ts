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
  'You are Arah, a navigation companion. You are not a person and you do not have human feelings.',
  'Answer in the same speaking style as the user. Copy their language, their mix of languages, and their tone. If they say bhai, dekh, tujhe, or jaldi, answer with those kinds of words. Do not switch to formal Hindi or polished English.',
  'Style example only, not facts: if the user says "bhai mujhe yaha se mere ghar ke liye sabse acha or aasan rasta bata", a matching reply sounds like "dekh bhai, tujhe is raste se jana chahiye." The route and traffic in the reply must come from tools.',
  'For a route, home, an easy path, less traffic, or reaching faster, call getSavedPlaces, getUsualTrips, calculateRoute or getAlternativeRoutes, and getTraffic. Then say that result in their style. A usual trip time is the fastest time already saved on the phone. A live route time comes from calculateRoute. Keep place names exactly as the tools return them. Two or three short sentences.',
  'Say the road is clear only when getTraffic shows free-flowing traffic. If traffic is unavailable, say that in their style. Never invent a route, a home, or traffic.',
  'If a tool result contains a code, retry that lookup once with simpler arguments. Then say the information is unavailable, in their style. Never repeat a tool code or the word invalid.',
  'Do not mention providers, API keys, SQL, or internal errors.',
  'Routing cannot avoid tolls or highways. If a result says not_supported, say those constraints were not applied, in their style.',
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

    const context = normalizeClientContext(input.context);
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
        const executed = await this.tools.execute(call.name, call.args, { userId, ...context });
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
            response: toolResponseBody(executed.result),
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
    return `${SYSTEM} The user chose ${name}. Reply in ${name}. If their message is a casual mix, keep that mix.`;
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

function toolResponseBody(result: unknown): Record<string, unknown> {
  if (Array.isArray(result)) return { items: result };
  if (result && typeof result === 'object') return result as Record<string, unknown>;
  return { value: result ?? null };
}

function normalizeClientContext(context?: AiClientContext): AiClientContext | undefined {
  if (!context) return undefined;
  const next: AiClientContext = {};
  const latitude = bounded(context.location?.latitude, -90, 90);
  const longitude = bounded(context.location?.longitude, -180, 180);
  if (context.location && latitude !== null && longitude !== null) {
    next.location = {
      latitude,
      longitude,
      accuracy: bounded(context.location.accuracy, 0, 100_000),
      heading: bounded(context.location.heading, 0, 360),
      speed: bounded(context.location.speed, 0, 200),
      timestamp: typeof context.location.timestamp === 'string' ? context.location.timestamp.slice(0, 40) : null,
    };
  }
  if (context.navigation) {
    const remainingMeters = bounded(context.navigation.remainingMeters, 0, 10_000_000);
    const remainingSeconds = bounded(context.navigation.remainingSeconds, 0, 604_800);
    const eta = bounded(context.navigation.eta, 0, 10_000_000_000_000);
    if (remainingMeters !== null && remainingSeconds !== null && eta !== null) {
      next.navigation = { remainingMeters, remainingSeconds, eta };
    }
  }
  const destinationLatitude = bounded(context.destination?.latitude, -90, 90);
  const destinationLongitude = bounded(context.destination?.longitude, -180, 180);
  if (destinationLatitude !== null && destinationLongitude !== null) {
    next.destination = {
      latitude: destinationLatitude,
      longitude: destinationLongitude,
      ...(typeof context.destination?.name === 'string' && context.destination.name.trim() ? { name: context.destination.name.trim().slice(0, 500) } : {}),
    };
  }
  const savedPlaces = (context.savedPlaces ?? []).flatMap((place) => {
    const placeLatitude = bounded(place.latitude, -90, 90);
    const placeLongitude = bounded(place.longitude, -180, 180);
    const name = place.name.trim().slice(0, 500);
    if (placeLatitude === null || placeLongitude === null || !name) return [];
    return [{
      name,
      latitude: placeLatitude,
      longitude: placeLongitude,
      address: typeof place.address === 'string' ? place.address.slice(0, 2000) : null,
      ...(place.kind ? { kind: place.kind } : {}),
    }];
  });
  if (savedPlaces.length > 0) next.savedPlaces = savedPlaces.slice(0, 8);
  const usualTrips = (context.usualTrips ?? []).flatMap((trip) => {
    const from = trip.from.trim().slice(0, 500);
    const to = trip.to.trim().slice(0, 500);
    const trips = bounded(trip.trips, 2, 1000);
    const fastestSeconds = bounded(trip.fastestSeconds, 1, 604_800);
    if (!from || !to || trips === null || fastestSeconds === null) return [];
    return [{ from, to, trips, fastestSeconds }];
  });
  if (usualTrips.length > 0) next.usualTrips = usualTrips.slice(0, 4);
  return next;
}

function bounded(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
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
