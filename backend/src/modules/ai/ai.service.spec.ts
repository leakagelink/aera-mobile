import { aiError } from '../../providers/gemini.provider';
import { AiService } from './ai.service';

const config = { aiMaxToolRounds: 5, aiMaxMessageChars: 50, aiMaxContextMessages: 2, aiRateLimitPerMinute: 2 };
const resolved = { enabled: true, apiKey: 'gemini-test-key', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash', timeoutMs: 1000, provider: 'gemini', providerType: 'ai', source: 'environment' };

const relayResolved = { enabled: true, apiKey: 'relay-secret-key', baseUrl: 'https://api.relaymodels.com/v1', model: 'gpt-5-mini', timeoutMs: 1000, provider: 'relay', providerType: 'ai', source: 'database' };

function service(options: { rounds?: number; allowed?: boolean; gemini?: unknown; relay?: unknown; execute?: jest.Mock; generate?: jest.Mock; relayGenerate?: jest.Mock } = {}) {
  const generate = options.generate ?? jest.fn(async () => ({ text: 'Your speed is 12 m/s.', functionCalls: [] }));
  const relayGenerate = options.relayGenerate ?? jest.fn(async () => ({ text: 'Backup answer.', functionCalls: [] }));
  const execute = options.execute ?? jest.fn(async () => ({ result: { speed: 12, unit: 'm/s' }, activity: { name: 'getCurrentSpeed', status: 'ok', activity: 'Checking your speed...' } }));
  const ai = new AiService(
    { generate } as never,
    { generate: relayGenerate } as never,
    { declarations: () => [{ name: 'getCurrentSpeed', description: 'speed', parameters: {} }], execute } as never,
    {
      activeGemini: async () => ('gemini' in options ? options.gemini : resolved),
      activeRelay: async () => ('relay' in options ? options.relay : null),
    } as never,
    { takeToken: async () => options.allowed ?? true } as never,
    { ...config, aiMaxToolRounds: options.rounds ?? config.aiMaxToolRounds } as never,
  );
  return { ai, generate, execute, relayGenerate };
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

  it('asks the model to reply in the language the user selected', async () => {
    const { ai, generate } = service();
    await ai.chat('user-1', { message: 'Namaste', language: 'hi' });
    expect(generate.mock.calls[0][0].system).toContain('Reply in Hindi');
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

  it('switches to Relay Models when Gemini fails and keeps both keys out of the answer', async () => {
    const generate = jest.fn(async () => {
      throw aiError('GEMINI_UNAVAILABLE', 'The assistant is unavailable.', 502);
    });
    const relayGenerate = jest.fn(async () => ({ text: 'Backup answer.', functionCalls: [] }));
    const { ai } = service({ generate, relayGenerate, relay: relayResolved });
    const result = await ai.chat('user-1', { message: 'Hello' });
    expect(result.message).toBe('Backup answer.');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(relayGenerate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('gemini-test-key');
    expect(JSON.stringify(result)).not.toContain('relay-secret-key');
  });

  it('uses Relay Models when Gemini is not configured', async () => {
    const relayGenerate = jest.fn(async () => ({ text: 'Relay only.', functionCalls: [] }));
    const { ai, generate } = service({ gemini: null, relay: relayResolved, relayGenerate });
    await expect(ai.chat('user-1', { message: 'Hello' })).resolves.toMatchObject({ message: 'Relay only.' });
    expect(generate).not.toHaveBeenCalled();
    expect(relayGenerate).toHaveBeenCalledTimes(1);
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
