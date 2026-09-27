import { providerStatus } from './catalog';

describe('providerStatus', () => {
  it('does not report a connection before a successful test', () => {
    expect(providerStatus({ configured: true, enabled: true, lastTestStatus: null })).toBe('NOT CONFIGURED');
    expect(providerStatus({ configured: true, enabled: true, lastTestStatus: 'success' })).toBe('CONNECTED');
    expect(providerStatus({ configured: true, enabled: true, lastTestStatus: 'failure' })).toBe('ERROR');
    expect(providerStatus({ configured: true, enabled: false, lastTestStatus: 'success' })).toBe('DISABLED');
    expect(providerStatus({ configured: false, enabled: true, lastTestStatus: null })).toBe('NOT CONFIGURED');
  });
});
