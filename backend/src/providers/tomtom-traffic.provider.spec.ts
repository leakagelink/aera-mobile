import { TomTomTrafficProvider } from './tomtom-traffic.provider';

describe('TomTomTrafficProvider', () => {
  it('normalizes flow speed to meters per second and keeps incidents when the incident call fails', async () => {
    const provider = new TomTomTrafficProvider(async (url) => {
      expect(url).not.toContain('log');
      if (url.includes('flowSegmentData')) {
        return { status: 200, body: { flowSegmentData: { currentSpeed: 36, freeFlowSpeed: 72, confidence: 0.9, roadClosure: false } } };
      }
      return { status: 500, body: { message: 'key=tomtom-test-key' } };
    });
    const report = await provider.report({
      latitude: 22.72,
      longitude: 75.86,
      baseUrl: 'https://api.tomtom.com',
      apiKey: 'tomtom-test-key',
      timeoutMs: 1000,
    });
    expect(report.available).toBe(true);
    expect(report.flow?.currentSpeedMps).toBeCloseTo(10);
    expect(report.incidents).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('tomtom-test-key');
  });

  it('returns auth failure without the provider body', async () => {
    const provider = new TomTomTrafficProvider(async () => ({ status: 403, body: { detailedError: { message: 'tomtom-test-key' } } }));
    await expect(
      provider.report({ latitude: 1, longitude: 2, baseUrl: 'https://api.tomtom.com', apiKey: 'tomtom-test-key', timeoutMs: 1000 }),
    ).resolves.toMatchObject({ available: false, reason: 'auth_failed', incidents: [] });
  });
});
