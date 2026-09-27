import { distanceMeters, lineStringWkt } from './geo';

describe('geo', () => {
  it('builds a PostGIS linestring from validated coordinates', () => {
    expect(lineStringWkt([{ latitude: 12.9, longitude: 77.5 }, { latitude: 13, longitude: 77.6 }])).toBe(
      'SRID=4326;LINESTRING(77.5000000 12.9000000, 77.6000000 13.0000000)',
    );
  });

  it('refuses a single point as a line', () => {
    expect(lineStringWkt([{ latitude: 12.9, longitude: 77.5 }])).toBeNull();
  });

  it('measures a short distance in meters', () => {
    const meters = distanceMeters({ latitude: 12.97, longitude: 77.59 }, { latitude: 12.971, longitude: 77.59 });
    expect(meters).toBeGreaterThan(100);
    expect(meters).toBeLessThan(120);
  });
});
