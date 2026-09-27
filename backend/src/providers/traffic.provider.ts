import type { TrafficProvider } from './types';

export class UnavailableTrafficProvider implements TrafficProvider {
  readonly id = 'unavailable' as const;

  report(): { available: false; reason: 'not_configured' } {
    return { available: false, reason: 'not_configured' };
  }
}
