import { Injectable } from '@nestjs/common';

import { TomTomTrafficProvider, type TrafficReport } from '../../providers/tomtom-traffic.provider';
import { ProviderConfigService } from '../provider-config/provider-config.service';
import { trafficLevel, type TrafficLevel } from './traffic-level';

export type FlowSample = {
  latitude: number;
  longitude: number;
  level: TrafficLevel | null;
};

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

  async flowSamples(points: { latitude: number; longitude: number }[]): Promise<{ available: boolean; samples: FlowSample[] }> {
    const unique = points
      .filter(
        (point, index) =>
          Number.isFinite(point.latitude) &&
          Number.isFinite(point.longitude) &&
          Math.abs(point.latitude) <= 90 &&
          Math.abs(point.longitude) <= 180 &&
          points.findIndex((other) => other.latitude === point.latitude && other.longitude === point.longitude) === index,
      )
      .slice(0, 4);
    const resolved = await this.configs.activeTomTom();
    if (!resolved?.enabled || !resolved.apiKey || unique.length === 0) return { available: false, samples: [] };
    const samples: FlowSample[] = [];
    for (const point of unique) {
      const report = await this.tomtom.report({
        latitude: point.latitude,
        longitude: point.longitude,
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
        timeoutMs: resolved.timeoutMs,
        includeIncidents: false,
      });
      samples.push({
        latitude: point.latitude,
        longitude: point.longitude,
        level: report.available ? trafficLevel(report.flow) : null,
      });
    }
    return { available: true, samples };
  }
}
