import { trafficLevel } from './traffic-level';
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

  it('colors only samples that have both speeds', async () => {
    const tomtom = {
      report: jest.fn(async () => ({
        available: true,
        flow: { currentSpeedMps: 4, freeFlowSpeedMps: 10, confidence: 0.9, roadClosure: false },
        incidents: [],
      })),
    };
    const service = new TrafficService(
      { activeTomTom: async () => ({ enabled: true, apiKey: 'tomtom-test-key', baseUrl: 'https://api.tomtom.com', timeoutMs: 1000 }) } as never,
      tomtom as never,
    );
    await expect(service.flowSamples([{ latitude: 22.7, longitude: 75.8 }])).resolves.toEqual({
      available: true,
      samples: [{ latitude: 22.7, longitude: 75.8, level: 'heavy' }],
    });
    expect(tomtom.report).toHaveBeenCalledWith(expect.objectContaining({ includeIncidents: false }));
  });

  it('does not invent a color when TomTom is off', async () => {
    const tomtom = { report: jest.fn() };
    const service = new TrafficService({ activeTomTom: async () => null } as never, tomtom as never);
    await expect(service.flowSamples([{ latitude: 22.7, longitude: 75.8 }])).resolves.toEqual({ available: false, samples: [] });
    expect(tomtom.report).not.toHaveBeenCalled();
  });
});

describe('trafficLevel', () => {
  const flow = { currentSpeedMps: 9, freeFlowSpeedMps: 10, confidence: 1, roadClosure: false };

  it('keeps unknown speeds uncolored', () => {
    expect(trafficLevel(null)).toBeNull();
    expect(trafficLevel({ ...flow, currentSpeedMps: null })).toBeNull();
    expect(trafficLevel({ ...flow, confidence: 0.2 })).toBeNull();
  });

  it('uses the speed ratio and a closure', () => {
    expect(trafficLevel(flow)).toBe('clear');
    expect(trafficLevel({ ...flow, currentSpeedMps: 6 })).toBe('slow');
    expect(trafficLevel({ ...flow, currentSpeedMps: 3 })).toBe('heavy');
    expect(trafficLevel({ ...flow, currentSpeedMps: null, freeFlowSpeedMps: null, roadClosure: true })).toBe('heavy');
  });
});
