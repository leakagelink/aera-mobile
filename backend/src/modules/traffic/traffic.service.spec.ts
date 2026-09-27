import { TrafficService } from './traffic.service';

describe('TrafficService', () => {
  it('does not invent traffic when TomTom is not configured', async () => {
    const tomtom = { report: jest.fn() };
    const service = new TrafficService({ activeTomTom: async () => null } as never, tomtom as never);
    await expect(service.report(22.7, 75.8)).resolves.toEqual({ available: false, reason: 'not_configured', flow: null, incidents: [] });
    expect(tomtom.report).not.toHaveBeenCalled();
  });

  it('asks TomTom only for a real coordinate', async () => {
    const tomtom = { report: jest.fn(async () => ({ available: true, flow: { currentSpeedMps: 8, freeFlowSpeedMps: 14, confidence: 1, roadClosure: false }, incidents: [] })) };
    const service = new TrafficService(
      { activeTomTom: async () => ({ enabled: true, apiKey: 'tomtom-test-key', baseUrl: 'https://api.tomtom.com', timeoutMs: 1000 }) } as never,
      tomtom as never,
    );
    await expect(service.report()).resolves.toMatchObject({ available: false, reason: 'location_required' });
    await expect(service.report(22.7, 75.8)).resolves.toMatchObject({ available: true });
    expect(tomtom.report).toHaveBeenCalledTimes(1);
  });
});
