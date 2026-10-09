import { cardsFromToolResult } from './ai-cards';

describe('cardsFromToolResult', () => {
  it('turns place and route tool results into cards', () => {
    expect(cardsFromToolResult([{ name: 'City Hospital', latitude: 22.7, longitude: 75.8, address: 'MG Road', distanceMeters: 180 }])).toEqual([
      { type: 'places', places: [{ name: 'City Hospital', latitude: 22.7, longitude: 75.8, address: 'MG Road', distanceMeters: 180 }] },
    ]);
    expect(
      cardsFromToolResult({
        summary: 'Airport Road',
        distanceMeters: 1000,
        durationSeconds: 120,
        end: { latitude: 22.73, longitude: 75.87 },
      }),
    ).toEqual([{ type: 'route', name: 'Route', summary: 'Airport Road', distanceMeters: 1000, durationSeconds: 120, latitude: 22.73, longitude: 75.87 }]);
    expect(cardsFromToolResult({ code: 'LOCATION_UNAVAILABLE' })).toEqual([]);
  });
});
