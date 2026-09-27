import { sanitizeProviderError, stripSecretFields } from './sanitize';

describe('sanitizeProviderError', () => {
  it('removes provider credentials from error text', () => {
    const raw = 'upstream https://api.openweathermap.org/data/2.5/weather?appid=test-key-1234&lat=1 Bearer test-key-1234';
    const clean = sanitizeProviderError(raw);
    expect(clean).not.toContain('test-key-1234');
    expect(clean).toContain('appid=redacted');
    expect(clean).toContain('Bearer redacted');
  });

  it('drops secret fields from stored config JSON', () => {
    expect(stripSecretFields({ apiKey: 'test-key-1234', units: 'metric' })).toEqual({ units: 'metric' });
  });
});
