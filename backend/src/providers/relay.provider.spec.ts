import { RelayProvider, toRelayMessages } from './relay.provider';

const input = {
  baseUrl: 'https://api.relaymodels.com/v1',
  apiKey: 'relay-test-key',
  model: 'gpt-5-mini',
  timeoutMs: 1000,
  system: 'You are Arah.',
  contents: [{ role: 'user' as const, parts: [{ text: 'What is my speed?' }] }],
  tools: [{ name: 'getCurrentSpeed', description: 'Read speed', parameters: { type: 'object', properties: {} } }],
};

describe('RelayProvider', () => {
  it('sends the key as a bearer token and reads a tool call', async () => {
    let seenUrl = '';
    let seenKey = '';
    let seenBody = '';
    const provider = new RelayProvider(async (url, init) => {
      seenUrl = url;
      seenKey = init.apiKey;
      seenBody = init.body;
      return {
        status: 200,
        body: { choices: [{ message: { content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'getCurrentSpeed', arguments: '{}' } }] } }] },
      };
    });
    await expect(provider.generate(input)).resolves.toEqual({
      text: null,
      functionCalls: [{ name: 'getCurrentSpeed', args: {}, id: 'call-1' }],
      modelParts: [{ functionCall: { name: 'getCurrentSpeed', args: {}, id: 'call-1' } }],
    });
    expect(seenUrl).toBe('https://api.relaymodels.com/v1/chat/completions');
    expect(seenUrl).not.toContain('relay-test-key');
    expect(seenBody).not.toContain('relay-test-key');
    expect(seenKey).toBe('relay-test-key');
    expect(JSON.parse(seenBody).model).toBe('gpt-5-mini');
  });

  it('keeps a Gemini tool result attached to the same call id', () => {
    const messages = toRelayMessages('You are Arah.', [
      { role: 'model', parts: [{ functionCall: { name: 'getCurrentSpeed', args: {}, id: 'call-9' } }] },
      { role: 'user', parts: [{ functionResponse: { name: 'getCurrentSpeed', id: 'call-9', response: { speed: 12 } } }] },
    ]);
    expect(messages[1]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'call-9' }] });
    expect(messages[2]).toEqual({ role: 'tool', tool_call_id: 'call-9', content: JSON.stringify({ speed: 12 }) });
  });

  it('maps auth, rate limit, timeout, and empty responses', async () => {
    const auth = new RelayProvider(async () => ({ status: 401, body: { error: { message: 'key=relay-test-key' } } }));
    await expect(auth.generate(input)).rejects.toMatchObject({ status: 502 });
    const limited = new RelayProvider(async () => ({ status: 429, body: null }));
    await expect(limited.generate(input)).rejects.toMatchObject({ status: 429 });
    const timeout = new RelayProvider(async () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    });
    await expect(timeout.generate(input)).rejects.toMatchObject({ status: 504 });
    const empty = new RelayProvider(async () => ({ status: 200, body: { choices: [{ message: { content: null } }] } }));
    await expect(empty.generate(input)).rejects.toMatchObject({ status: 502 });
    const text = new RelayProvider(async () => ({ status: 200, body: { choices: [{ message: { content: 'Backup answer.' } }] } }));
    await expect(text.generate(input)).resolves.toMatchObject({ text: 'Backup answer.', functionCalls: [] });
  });
});
