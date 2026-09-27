import { loadConfig } from '../src/config/load-config';
import { createProviders } from '../src/providers/registry';

describe('provider configuration', () => {
  it('wires Nominatim, OSRM, and an explicit traffic placeholder', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://aera:replace-with-a-local-password@localhost:5432/aera',
      REDIS_URL: 'redis://localhost:6379',
    });
    const providers = createProviders(config);
    expect(providers.search).toBe(providers.geocoding);
    expect(providers.routing).toBeDefined();
    expect(providers.traffic.report()).toEqual({ available: false, reason: 'not_configured' });
  });
});
