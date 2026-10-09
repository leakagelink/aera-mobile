import { ArahException } from '../security/weather-errors';

const TTS_MODEL = 'eleven_multilingual_v2';
const STT_MODEL = 'scribe_v2';
export const DEFAULT_ELEVENLABS_VOICE = 'JBFqnCBsd6RMkjVDRZzb';

export type ElevenFetch = (
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string | FormData; timeoutMs: number; expect: 'json' | 'bytes' },
) => Promise<{ status: number; json: unknown; bytes: Uint8Array }>;

export class ElevenLabsProvider {
  constructor(private readonly fetchEleven: ElevenFetch = defaultElevenFetch) {}

  async speak(input: { baseUrl: string; apiKey: string; voiceId: string; text: string; timeoutMs: number }): Promise<Uint8Array> {
    const voiceId = input.voiceId.trim() || DEFAULT_ELEVENLABS_VOICE;
    const url = new URL(`v1/text-to-speech/${encodeURIComponent(voiceId)}`, ensureSlash(input.baseUrl));
    url.searchParams.set('output_format', 'mp3_22050_32');
    const response = await this.fetchEleven(url.toString(), {
      method: 'POST',
      headers: { 'xi-api-key': input.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: input.text, model_id: TTS_MODEL }),
      timeoutMs: input.timeoutMs,
      expect: 'bytes',
    });
    assertOk(response.status, input.apiKey);
    if (response.bytes.byteLength < 32) throw voiceError('The voice reply was empty.');
    return response.bytes;
  }

  async transcribe(input: { baseUrl: string; apiKey: string; audio: Uint8Array; mimeType: string; timeoutMs: number }): Promise<string> {
    const url = new URL('v1/speech-to-text', ensureSlash(input.baseUrl));
    const form = new FormData();
    form.append('model_id', STT_MODEL);
    form.append('file', new Blob([Uint8Array.from(input.audio)], { type: input.mimeType || 'audio/mp4' }), 'speech.m4a');
    const response = await this.fetchEleven(url.toString(), {
      method: 'POST',
      headers: { 'xi-api-key': input.apiKey, Accept: 'application/json' },
      body: form,
      timeoutMs: input.timeoutMs,
      expect: 'json',
    });
    assertOk(response.status, input.apiKey);
    const text = response.json && typeof response.json === 'object' ? (response.json as { text?: unknown }).text : undefined;
    if (typeof text !== 'string' || !text.trim()) throw voiceError('No words were recognized.');
    return text.trim();
  }
}

export function voiceError(message: string, status = 502): ArahException {
  return new ArahException('VOICE_UNAVAILABLE', message, status);
}

function assertOk(status: number, apiKey: string): void {
  if (status === 401 || status === 403) throw voiceError('The voice service rejected the server credentials.');
  if (status === 429) throw voiceError('The voice service is busy. Try again shortly.', 429);
  if (status < 200 || status >= 300) throw voiceError('The voice service is unavailable.');
  if (apiKey && status === 0) throw voiceError('The voice service is unavailable.');
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

async function defaultElevenFetch(
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string | FormData; timeoutMs: number; expect: 'json' | 'bytes' },
): Promise<{ status: number; json: unknown; bytes: Uint8Array }> {
  const apiKey = init.headers['xi-api-key'] ?? '';
  if (apiKey && url.includes(apiKey)) throw voiceError('The voice request was rejected.');
  const response = await fetch(url, { method: init.method, headers: init.headers, body: init.body, signal: AbortSignal.timeout(init.timeoutMs) });
  if (init.expect === 'bytes') {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, json: null, bytes };
  }
  const json = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, json, bytes: new Uint8Array() };
}
