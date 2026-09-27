import { AiService } from './ai.service';

const config = { aiMaxToolRounds: 5, aiMaxMessageChars: 50, aiMaxContextMessages: 2, aiRateLimitPerMinute: 2 };
const resolved = { enabled: true, apiKey: 'gemini-test-key', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash', timeoutMs: 1000, provider: 'gemini', providerType: 'ai', source: 'environment' };

function service(options: { rounds?: number; allowed?: boolean; gemini?: unknown; execute?: jest.Mock; generate?: jest.Mock } = {}) {
  const generate = options.generate ?? jest.fn(async () => ({ text: 'Your speed is 12 m/s.', functionCalls: [] }));
  const execute = options.execute ?? jest.fn(async () => ({ result: { speed: 12, unit: 'm/s' }, activity: { name: 'getCurrentSpeed', status: 'ok', activity: 'Checking your speed...' } }));
  const ai = new AiService(
    { generate } as never,
    { declarations: () => [{ name: 'getCurrentSpeed', description: 'speed', parameters: {} }], execute } as never,
    { activeGemini: async () => ('gemini' in options ? options.gemini : resolved) } as never,
    { takeToken: async () => options.allowed ?? true } as never,
    { ...config, aiMaxToolRounds: options.rounds ?? config.aiMaxToolRounds } as never,
  );
  return { ai, generate, execute };
}

describe('AiService', () => {
  it('runs a tool and returns the final answer without the Gemini key', async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({ text: null, functionCalls: [{ name: 'getCurrentSpeed', args: {} }] })
      .mockResolvedValueOnce({ text: 'You are moving at 12 m/s.', functionCalls: [] });
    const { ai, execute } = service({ generate });
    const result = await ai.chat('user-1', { message: 'What is my speed?' });
    expect(execute).toHaveBeenCalledWith('getCurrentSpeed', {}, { userId: 'user-1' });
    expect(result).toEqual({ message: 'You are moving at 12 m/s.', toolCalls: [{ name: 'getCurrentSpeed', status: 'ok', activity: 'Checking your speed...' }] });
    expect(JSON.stringify(result)).not.toContain('gemini-test-key');
  });

  it('stops after the configured tool rounds and after repeated rejections', async () => {
    const generate = jest.fn(async () => ({ text: null, functionCalls: [{ name: 'getWeather', args: {} }] }));
    const limited = service({ generate, rounds: 1 });
    await expect(limited.ai.chat('user-1', { message: 'Weather' })).resolves.toMatchObject({ message: 'I could not finish that request within the lookup limit.' });
    expect(generate).toHaveBeenCalledTimes(1);

    const rejected = jest.fn(async () => ({ result: { code: 'AI_TOOL_NOT_FOUND' }, activity: { name: 'unknown', status: 'rejected', activity: 'Could not complete that lookup.' } }));
    const looping = service({
      execute: rejected,
      generate: jest.fn(async () => ({ text: null, functionCalls: [{ name: 'unknown', args: {} }] })),
    });
    await expect(looping.ai.chat('user-1', { message: 'Do something unsafe' })).resolves.toMatchObject({ message: 'I could not complete that request with the available Arah tools.' });
    expect(rejected).toHaveBeenCalledTimes(2);

    const repeated = jest.fn(async () => ({ result: { ok: true }, activity: { name: 'getWeather', status: 'ok' as const, activity: 'Checking weather...' } }));
    const repeating = service({
      execute: repeated,
      generate: jest.fn(async () => ({ text: null, functionCalls: [{ name: 'getWeather', args: {} }] })),
    });
    await expect(repeating.ai.chat('user-1', { message: 'Weather' })).resolves.toMatchObject({ message: 'I stopped before repeating the same lookup.' });
    expect(repeated).toHaveBeenCalledTimes(3);
  });

  it('rate limits and reports Gemini as unavailable', async () => {
    const blocked = service({ allowed: false });
    await expect(blocked.ai.chat('user-1', { message: 'Hello' })).rejects.toMatchObject({ status: 429 });
    expect(blocked.generate).not.toHaveBeenCalled();
    const missing = service({ gemini: null });
    await expect(missing.ai.chat('user-1', { message: 'Hello' })).rejects.toMatchObject({ status: 503 });
    await expect(service().ai.chat('user-1', { message: 'x'.repeat(51) })).rejects.toMatchObject({ status: 400 });
  });

  it('sends only the bounded conversation', async () => {
    const { ai, generate } = service();
    await ai.chat('user-1', {
      message: 'Now',
      history: [
        { role: 'user', text: 'one' },
        { role: 'assistant', text: 'two' },
        { role: 'user', text: 'three' },
      ],
    });
    const contents = generate.mock.calls[0][0].contents as { parts: { text: string }[] }[];
    expect(contents.map((entry) => entry.parts[0].text)).toEqual(['two', 'three', 'Now']);
  });
});
