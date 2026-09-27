import { computeTripMetrics } from './trip-metrics';

describe('computeTripMetrics', () => {
  it('sums plausible movement and ignores a GPS spike', () => {
    const metrics = computeTripMetrics(
      [
        { recordedAt: '2026-09-27T06:00:00.000Z', latitude: 12.97, longitude: 77.59, accuracy: 8, speed: 5 },
        { recordedAt: '2026-09-27T06:00:10.000Z', latitude: 12.971, longitude: 77.59, accuracy: 8, speed: 5 },
        { recordedAt: '2026-09-27T06:00:11.000Z', latitude: 13.5, longitude: 77.59, accuracy: 8, speed: 5 },
      ],
      '2026-09-27T06:00:00.000Z',
      '2026-09-27T06:01:00.000Z',
    );
    expect(metrics.distanceMeters).toBeGreaterThan(100);
    expect(metrics.distanceMeters).toBeLessThan(200);
    expect(metrics.durationSeconds).toBe(60);
    expect(metrics.movingSeconds).toBe(10);
  });
});
