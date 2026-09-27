import { ArahException } from '../security/weather-errors';

export type GeminiFunctionCall = {
  name: string;
  args: Record<string, unknown>;
};

export type GeminiTurn = {
  text: string | null;
  functionCalls: GeminiFunctionCall[];
};

export type GeminiToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type GeminiContent = {
  role: 'user' | 'model';
  parts: Record<string, unknown>[];
};

export type GeminiFetch = (url: string, init: { body: string; timeoutMs: number; apiKey: string }) => Promise<{ status: number; body: unknown }>;

export class GeminiProvider {
  constructor(private readonly fetchGemini: GeminiFetch = defaultGeminiFetch) {}

  async generate(input: {
    baseUrl: string;
    apiKey: string;
    model: string;
    timeoutMs: number;
    system: string;
    contents: GeminiContent[];
    tools: GeminiToolDeclaration[];
  }): Promise<GeminiTurn> {
    if (!input.apiKey.trim()) throw aiError('GEMINI_NOT_CONFIGURED', 'The assistant is not configured.', 503);
    const url = new URL(`/v1beta/models/${encodeURIComponent(input.model)}:generateContent`, ensureSlash(input.baseUrl));
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: input.contents,
      tools: [{ functionDeclarations: input.tools }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
    });
    if (body.includes(input.apiKey)) throw aiError('GEMINI_AUTH_FAILED', 'The assistant request was rejected.', 502);
    let response: { status: number; body: unknown };
    try {
      response = await this.fetchGemini(url.toString(), { body, timeoutMs: input.timeoutMs, apiKey: input.apiKey });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') throw aiError('GEMINI_TIMEOUT', 'The assistant took too long to respond.', 504);
      throw aiError('GEMINI_UNAVAILABLE', 'The assistant is unavailable.', 502);
    }
    if (response.status === 401 || response.status === 403) throw aiError('GEMINI_AUTH_FAILED', 'The assistant rejected the server credentials.', 502);
    if (response.status === 429) throw aiError('GEMINI_RATE_LIMITED', 'The assistant is busy. Try again shortly.', 429);
    if (response.status < 200 || response.status >= 300) throw aiError('GEMINI_UNAVAILABLE', 'The assistant is unavailable.', 502);
    return parseTurn(response.body);
  }
}

export function aiError(code: string, message: string, status: number): ArahException {
  return new ArahException(code, message, status);
}

function parseTurn(payload: unknown): GeminiTurn {
  const body = payload && typeof payload === 'object' ? (payload as { candidates?: { content?: { parts?: unknown[] } }[] }) : {};
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
  const functionCalls = parts.flatMap((part) => {
    if (!part || typeof part !== 'object' || !('functionCall' in part)) return [];
    const call = (part as { functionCall?: { name?: unknown; args?: unknown } }).functionCall;
    if (!call || typeof call.name !== 'string') return [];
    const args = call.args && typeof call.args === 'object' && !Array.isArray(call.args) ? (call.args as Record<string, unknown>) : {};
    return [{ name: call.name, args }];
  });
  if (!text && functionCalls.length === 0) throw aiError('GEMINI_UNAVAILABLE', 'The assistant returned an empty response.', 502);
  return { text: text || null, functionCalls };
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

async function defaultGeminiFetch(url: string, init: { body: string; timeoutMs: number; apiKey: string }): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-goog-api-key': init.apiKey },
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
