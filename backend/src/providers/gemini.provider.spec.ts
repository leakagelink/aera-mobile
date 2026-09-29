import { currentGeminiModel } from './gemini-model';
import { GeminiProvider } from './gemini.provider';

const input = {
  baseUrl: 'https://generativelanguage.googleapis.com',
  apiKey: 'gemini-test-key',
  model: 'gemini-2.0-flash',
  timeoutMs: 1000,
  system: 'You are Arah.',
  contents: [{ role: 'user' as const, parts: [{ text: 'What is my speed?' }] }],
  tools: [{ name: 'getCurrentSpeed', description: 'Read speed', parameters: { type: 'object', properties: {} } }],
};

describe('currentGeminiModel', () => {
  it('replaces the shut-down Gemini 2.0 models', () => {
    expect(currentGeminiModel('gemini-2.0-flash')).toBe('gemini-2.5-flash-lite');
    expect(currentGeminiModel('gemini-3.6-flash')).toBe('gemini-2.5-flash-lite');
    expect(currentGeminiModel('  ')).toBe('gemini-2.5-flash-lite');
    expect(currentGeminiModel('gemini-3.8-flash')).toBe('gemini-3.8-flash');
  });
});

describe('GeminiProvider', () => {
  it('sends the key in the header and reads a function call', async () => {
    let seenUrl = '';
    let seenKey = '';
    let seenBody = '';
    const provider = new GeminiProvider(async (url, init) => {
      seenUrl = url;
      seenKey = init.apiKey;
      seenBody = init.body;
      return {
        status: 200,
        body: { candidates: [{ content: { parts: [{ functionCall: { name: 'getCurrentSpeed', args: {} } }] } }] },
      };
    });
    await expect(provider.generate(input)).resolves.toEqual({
      text: null,
      functionCalls: [{ name: 'getCurrentSpeed', args: {} }],
      modelParts: [{ functionCall: { name: 'getCurrentSpeed', args: {} } }],
    });
    expect(seenUrl).not.toContain('gemini-test-key');
    expect(seenBody).not.toContain('gemini-test-key');
    expect(seenKey).toBe('gemini-test-key');
    expect(JSON.parse(seenBody).generationConfig.maxOutputTokens).toBe(400);
  });

  it('maps auth, rate limit, timeout, and empty responses', async () => {
    const auth = new GeminiProvider(async () => ({ status: 401, body: { error: { message: 'key=gemini-test-key' } } }));
    await expect(auth.generate(input)).rejects.toMatchObject({ status: 502 });
    const limited = new GeminiProvider(async () => ({ status: 429, body: null }));
    await expect(limited.generate(input)).rejects.toMatchObject({ status: 429 });
    const timeout = new GeminiProvider(async () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    });
    await expect(timeout.generate(input)).rejects.toMatchObject({ status: 504 });
    const signed = new GeminiProvider(async () => ({
      status: 200,
      body: { candidates: [{ content: { parts: [{ functionCall: { name: 'getCurrentSpeed', args: {}, id: 'call-1' }, thoughtSignature: 'sig' }] } }] },
    }));
    await expect(signed.generate(input)).resolves.toMatchObject({
      functionCalls: [{ name: 'getCurrentSpeed', id: 'call-1' }],
      modelParts: [{ thoughtSignature: 'sig' }],
    });
    const empty = new GeminiProvider(async () => ({ status: 200, body: { candidates: [{ content: { parts: [] } }] } }));
    await expect(empty.generate(input)).rejects.toMatchObject({ status: 502 });
  });
});
