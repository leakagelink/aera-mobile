import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('spatial persistence SQL', () => {
  const trips = readFileSync(join(__dirname, '../src/modules/trips/trips.repository.ts'), 'utf8');
  const places = readFileSync(join(__dirname, '../src/modules/places/places.repository.ts'), 'utf8');

  it('writes sample points with PostGIS and reads progress along the planned line', () => {
    expect(trips).toContain('ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography');
    expect(trips).toContain('ST_LineLocatePoint');
    expect(trips).toContain('ST_AsGeoJSON');
  });

  it('prepares nearby lookup with distance and containment primitives', () => {
    expect(places).toContain('ST_DWithin');
    expect(places).toContain('ST_Distance');
  });
});
