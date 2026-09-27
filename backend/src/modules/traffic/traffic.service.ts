import { Injectable } from '@nestjs/common';

import { TomTomTrafficProvider, type TrafficReport } from '../../providers/tomtom-traffic.provider';
import { ProviderConfigService } from '../provider-config/provider-config.service';

@Injectable()
export class TrafficService {
  constructor(
    private readonly configs: ProviderConfigService,
    private readonly tomtom: TomTomTrafficProvider,
  ) {}

  async report(latitude?: number, longitude?: number): Promise<TrafficReport> {
    const resolved = await this.configs.activeTomTom();
    if (!resolved?.enabled || !resolved.apiKey) {
      return { available: false, reason: 'not_configured', flow: null, incidents: [] };
    }
    if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { available: false, reason: 'location_required', flow: null, incidents: [] };
    }
    const report = await this.tomtom.report({
      latitude,
      longitude,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey,
      timeoutMs: resolved.timeoutMs,
    });
    if (report.reason === 'auth_failed') return { ...report, available: false, reason: 'auth_failed' };
    return report;
  }
}
