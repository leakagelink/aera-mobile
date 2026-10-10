import { validateToolArgs } from './tool-schema';

const schema = {
  type: 'object' as const,
  properties: {
    latitude: { type: 'number' as const, minimum: -90, maximum: 90 },
    longitude: { type: 'number' as const, minimum: -180, maximum: 180 },
  },
};

describe('tool schema validation', () => {
  it('accepts coordinates, numeric strings, and ignores extra fields', () => {
    expect(validateToolArgs(schema, { latitude: 22.7, longitude: 75.8 }).ok).toBe(true);
    expect(validateToolArgs(schema, { latitude: '22.7', longitude: '75.8' })).toEqual({ ok: true, args: { latitude: 22.7, longitude: 75.8 } });
    expect(validateToolArgs(schema, { latitude: 22.7, longitude: 75.8, userId: 'someone-else' })).toEqual({ ok: true, args: { latitude: 22.7, longitude: 75.8 } });
    expect(validateToolArgs(schema, { latitude: 120, longitude: 0 }).ok).toBe(false);
    expect(validateToolArgs(schema, []).ok).toBe(false);
  });
});
