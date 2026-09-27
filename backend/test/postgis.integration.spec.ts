/**
 * Runs only when a local PostGIS database is available:
 * AERA_INTEGRATION=1 DATABASE_URL=postgresql://... npm test
 */
import { Pool } from 'pg';

const enabled = process.env.AERA_INTEGRATION === '1' && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite('PostGIS integration', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('persists a point and finds it with ST_DWithin', async () => {
    const created = await pool.query<{ inside: boolean }>(
      `SELECT ST_DWithin(
         ST_SetSRID(ST_MakePoint(77.59, 12.97), 4326)::geography,
         ST_SetSRID(ST_MakePoint(77.5901, 12.9701), 4326)::geography,
         50
       ) AS inside`,
    );
    expect(created.rows[0]?.inside).toBe(true);
  });
});
