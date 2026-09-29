import { ArahException } from '../security/weather-errors';
import { aiError, type GeminiContent, type GeminiFunctionCall, type GeminiToolDeclaration, type GeminiTurn } from './gemini.provider';

export type RelayFetch = (url: string, init: { body: string; timeoutMs: number; apiKey: string }) => Promise<{ status: number; body: unknown }>;

export const RELAY_MODEL = 'deepseek-v4-flash';

const REPLACED_RELAY_MODELS = new Set(['gpt-5-mini', 'qwen3.7-plus']);

export function currentRelayModel(configured: string | null | undefined): string {
  const model = configured?.trim();
  if (!model || REPLACED_RELAY_MODELS.has(model)) return RELAY_MODEL;
  return model;
}

export class RelayProvider {
  constructor(private readonly fetchRelay: RelayFetch = defaultRelayFetch) {}

  async generate(input: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
    system: string;
    contents: GeminiContent[];
    tools: GeminiToolDeclaration[];
  }): Promise<GeminiTurn> {
    if (!input.apiKey.trim()) throw aiError('RELAY_NOT_CONFIGURED', 'The assistant is not configured.', 503);
    const url = new URL('chat/completions', ensureSlash(input.baseUrl));
    const body = JSON.stringify({
      model: currentRelayModel(input.model),
      messages: toRelayMessages(input.system, input.contents),
      tools: input.tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      })),
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 400,
    });
    if (body.includes(input.apiKey) || url.toString().includes(input.apiKey)) {
      throw aiError('RELAY_AUTH_FAILED', 'The assistant request was rejected.', 502);
    }
    let response: { status: number; body: unknown };
    try {
      response = await this.fetchRelay(url.toString(), { body, timeoutMs: input.timeoutMs, apiKey: input.apiKey });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') throw aiError('RELAY_TIMEOUT', 'The assistant took too long to respond.', 504);
      throw aiError('RELAY_UNAVAILABLE', 'The assistant is unavailable.', 502);
    }
    if (response.status === 401 || response.status === 403) throw aiError('RELAY_AUTH_FAILED', 'The assistant rejected the server credentials.', 502);
    if (response.status === 429) throw aiError('RELAY_RATE_LIMITED', 'The assistant is busy. Try again shortly.', 429);
    if (response.status < 200 || response.status >= 300) throw aiError('RELAY_UNAVAILABLE', 'The assistant is unavailable.', 502);
    return parseTurn(response.body);
  }
}

export function toRelayMessages(system: string, contents: GeminiContent[]): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [{ role: 'system', content: system }];
  let pendingIds: string[] = [];
  for (const content of contents) {
    const calls = content.parts.filter((part) => part && typeof part === 'object' && 'functionCall' in part);
    const responses = content.parts.filter((part) => part && typeof part === 'object' && 'functionResponse' in part);
    const text = content.parts
      .map((part) => (part && typeof part === 'object' && typeof part.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (calls.length > 0) {
      pendingIds = calls.map((part, index) => callId(part.functionCall, index));
      messages.push({
        role: 'assistant',
        content: text || null,
        tool_calls: calls.map((part, index) => {
          const call = part.functionCall as { name?: unknown; args?: unknown };
          const args = call.args && typeof call.args === 'object' && !Array.isArray(call.args) ? call.args : {};
          return {
            id: pendingIds[index],
            type: 'function',
            function: { name: typeof call.name === 'string' ? call.name : 'tool', arguments: JSON.stringify(args) },
          };
        }),
      });
    } else if (responses.length > 0) {
      responses.forEach((part, index) => {
        const response = part.functionResponse as { name?: unknown; id?: unknown; response?: unknown };
        const id = typeof response.id === 'string' && response.id ? response.id : pendingIds[index] || `call_${String(response.name ?? 'tool')}_${index}`;
        messages.push({ role: 'tool', tool_call_id: id, content: JSON.stringify(response.response ?? {}) });
      });
      pendingIds = [];
    } else if (text) {
      messages.push({ role: content.role === 'model' ? 'assistant' : 'user', content: text });
    }
  }
  return messages;
}

function callId(value: unknown, index: number): string {
  const call = value && typeof value === 'object' ? (value as { id?: unknown; name?: unknown }) : {};
  if (typeof call.id === 'string' && call.id) return call.id;
  return `call_${typeof call.name === 'string' ? call.name : 'tool'}_${index}`;
}

function parseTurn(payload: unknown): GeminiTurn {
  const body = payload && typeof payload === 'object' ? (payload as { choices?: { message?: { content?: unknown; tool_calls?: unknown[] } }[] }) : {};
  const message = body.choices?.[0]?.message;
  const text = typeof message?.content === 'string' ? message.content.trim() : '';
  const rawCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const functionCalls: GeminiFunctionCall[] = rawCalls.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const call = entry as { id?: unknown; type?: unknown; function?: { name?: unknown; arguments?: unknown } };
    if (call.type && call.type !== 'function') return [];
    if (!call.function || typeof call.function.name !== 'string') return [];
    return [{ name: call.function.name, args: parseArgs(call.function.arguments), ...(typeof call.id === 'string' ? { id: call.id } : {}) }];
  });
  if (!text && functionCalls.length === 0) throw aiError('RELAY_UNAVAILABLE', 'The assistant returned an empty response.', 502);
  const modelParts = functionCalls.map((call) => ({ functionCall: { name: call.name, args: call.args, ...(call.id ? { id: call.id } : {}) } }));
  return { text: text || null, functionCalls, modelParts };
}

function parseArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

async function defaultRelayFetch(url: string, init: { body: string; timeoutMs: number; apiKey: string }): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${init.apiKey}` },
    body: init.body,
    signal: AbortSignal.timeout(init.timeoutMs),
  });
  const text = await response.text();
  if (!text) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: null };
  }
}

export function isRelayFallbackError(error: unknown): boolean {
  if (!(error instanceof ArahException)) return false;
  const status = error.getStatus();
  return status === 429 || status === 502 || status === 503 || status === 504;
}
