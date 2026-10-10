import { probeProvider } from './provider-probe';

describe('probeProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('tests TomTom through the traffic flow product', async () => {
    const seen: string[] = [];
    global.fetch = jest.fn(async (url: string | URL) => {
      seen.push(String(url));
      return {
        status: 200,
        text: async () => '{"flowSegmentData":{"currentSpeed":20,"freeFlowSpeed":40,"confidence":1,"roadClosure":false}}',
      } as Response;
    }) as typeof fetch;

    const result = await probeProvider('tomtom', { baseUrl: 'https://api.tomtom.com', apiKey: 'tomtom-test-key', timeoutMs: 1000 }, { geocodingUserAgent: 'test' });
    const flow = new URL(seen[0] ?? '');

    expect(result.success).toBe(true);
    expect(result.message).toBe('TomTom connection successful');
    expect(flow.pathname).toContain('/traffic/services/4/flowSegmentData/');
    expect(seen.some((url) => url.includes('/search/2/geocode/'))).toBe(false);
    expect(JSON.stringify(result)).not.toContain('tomtom-test-key');
  });

  it('accepts an ElevenLabs key that can list models', async () => {
    const seen: string[] = [];
    global.fetch = jest.fn(async (url: string | URL) => {
      seen.push(String(url));
      return { ok: true, status: 200, text: async () => '{"models":[]}' } as Response;
    }) as typeof fetch;

    const result = await probeProvider('elevenlabs', { baseUrl: 'https://api.elevenlabs.io/v1', apiKey: 'eleven-secret', timeoutMs: 1000 }, { geocodingUserAgent: 'test' });

    expect(result.success).toBe(true);
    expect(seen[0]).toBe('https://api.elevenlabs.io/v1/models');
    expect(JSON.stringify(result)).not.toContain('eleven-secret');
  });

  it('follows an ElevenLabs residency key to the matching host', async () => {
    const seen: string[] = [];
    global.fetch = jest.fn(async (url: string | URL) => {
      const href = String(url);
      seen.push(href);
      if (href.startsWith('https://api.in.residency.elevenlabs.io/')) return { ok: true, status: 200, text: async () => '{}' } as Response;
      return { ok: false, status: 401, text: async () => '{"detail":{"message":"The API key used is for a data residency stack"}}' } as Response;
    }) as typeof fetch;

    const result = await probeProvider('elevenlabs', { baseUrl: 'https://api.elevenlabs.io', apiKey: 'eleven-secret', timeoutMs: 1000 }, { geocodingUserAgent: 'test' });

    expect(result.success).toBe(true);
    expect(result.baseUrl).toBe('https://api.in.residency.elevenlabs.io');
    expect(seen[0]).toBe('https://api.elevenlabs.io/v1/models');
    expect(seen).toContain('https://api.in.residency.elevenlabs.io/v1/models');
  });

  it('accepts an ElevenLabs key that can list voices when models are blocked', async () => {
    global.fetch = jest.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith('/v1/voices')) return { ok: true, status: 200, text: async () => '{"voices":[]}' } as Response;
      return { ok: false, status: 401, text: async () => '{"detail":{"status":"missing_permissions"}}' } as Response;
    }) as typeof fetch;

    const result = await probeProvider('elevenlabs', { baseUrl: 'https://api.elevenlabs.io', apiKey: 'eleven-secret', timeoutMs: 1000 }, { geocodingUserAgent: 'test' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('ElevenLabs connection successful');
  });

  it('tells the admin when the ElevenLabs key ID was pasted', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 400, text: async () => '{"detail":{"status":"api_key_id_used_as_api_key"}}' }) as Response) as typeof fetch;

    const result = await probeProvider('elevenlabs', { baseUrl: 'https://api.elevenlabs.io', apiKey: 'eleven-secret', timeoutMs: 1000 }, { geocodingUserAgent: 'test' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('secret key');
    expect(JSON.stringify(result)).not.toContain('eleven-secret');
  });

  it('accepts an ElevenLabs key that can speak when list calls are blocked', async () => {
    global.fetch = jest.fn(async (url: string | URL, init?: RequestInit) => {
      if (init?.method === 'POST' && String(url).includes('/v1/text-to-speech/')) return { ok: true, status: 200, text: async () => '' } as Response;
      return { ok: false, status: 401, text: async () => '{"detail":{"status":"missing_permissions"}}' } as Response;
    }) as typeof fetch;

    const result = await probeProvider('elevenlabs', { baseUrl: 'https://api.elevenlabs.io', apiKey: 'eleven-secret', timeoutMs: 1000, model: 'voice-1' }, { geocodingUserAgent: 'test' });

    expect(result.success).toBe(true);
    expect(result.message).toBe('ElevenLabs connection successful');
  });
});
