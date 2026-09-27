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
});
