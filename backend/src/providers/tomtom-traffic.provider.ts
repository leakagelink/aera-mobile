export type TrafficReport = {
  available: boolean;
  reason?: 'not_configured' | 'location_required' | 'unavailable' | 'auth_failed';
  flow: { currentSpeedMps: number | null; freeFlowSpeedMps: number | null; confidence: number | null; roadClosure: boolean | null } | null;
  incidents: { category: string | null; delaySeconds: number | null; description: string | null; lengthMeters: number | null }[];
};

export type TrafficFetch = (url: string, timeoutMs: number) => Promise<{ status: number; body: unknown }>;

export class TomTomTrafficProvider {
  readonly id = 'tomtom';

  constructor(private readonly fetchTraffic: TrafficFetch = defaultTrafficFetch) {}

  async report(input: { latitude: number; longitude: number; baseUrl: string; apiKey: string; timeoutMs: number }): Promise<TrafficReport> {
    const flowUrl = new URL('/traffic/services/4/flowSegmentData/absolute/10/json', ensureSlash(input.baseUrl));
    flowUrl.searchParams.set('point', `${input.latitude},${input.longitude}`);
    flowUrl.searchParams.set('unit', 'KMPH');
    flowUrl.searchParams.set('key', input.apiKey);
    const flow = await this.read(flowUrl.toString(), input.timeoutMs);
    if (flow.status === 401 || flow.status === 403) {
      return { available: false, reason: 'auth_failed', flow: null, incidents: [] };
    }
    if (flow.status < 200 || flow.status >= 300) {
      return { available: false, reason: 'unavailable', flow: null, incidents: [] };
    }
    const incidents = await this.incidents(input).catch(() => []);
    return { available: true, flow: normalizeFlow(flow.body), incidents };
  }

  private async incidents(input: { latitude: number; longitude: number; baseUrl: string; apiKey: string; timeoutMs: number }) {
    const pad = 0.02;
    const bbox = `${input.longitude - pad},${input.latitude - pad},${input.longitude + pad},${input.latitude + pad}`;
    const url = new URL('/traffic/services/5/incidentDetails', ensureSlash(input.baseUrl));
    url.searchParams.set('bbox', bbox);
    url.searchParams.set('fields', '{incidents{properties{iconCategory,magnitudeOfDelay,events{description},delay,length}}}');
    url.searchParams.set('key', input.apiKey);
    const response = await this.read(url.toString(), input.timeoutMs);
    if (response.status < 200 || response.status >= 300) return [];
    return normalizeIncidents(response.body).slice(0, 5);
  }

  private async read(url: string, timeoutMs: number) {
    try {
      return await this.fetchTraffic(url, timeoutMs);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') return { status: 504, body: null };
      return { status: 502, body: null };
    }
  }
}

function normalizeFlow(payload: unknown): TrafficReport['flow'] {
  const data = payload && typeof payload === 'object' ? (payload as { flowSegmentData?: Record<string, unknown> }).flowSegmentData : undefined;
  if (!data) return null;
  return {
    currentSpeedMps: kmhToMps(data.currentSpeed),
    freeFlowSpeedMps: kmhToMps(data.freeFlowSpeed),
    confidence: typeof data.confidence === 'number' ? data.confidence : null,
    roadClosure: typeof data.roadClosure === 'boolean' ? data.roadClosure : null,
  };
}

function normalizeIncidents(payload: unknown): TrafficReport['incidents'] {
  const incidents = payload && typeof payload === 'object' ? (payload as { incidents?: unknown[] }).incidents : undefined;
  if (!Array.isArray(incidents)) return [];
  return incidents.flatMap((incident) => {
    if (!incident || typeof incident !== 'object') return [];
    const properties = (incident as { properties?: Record<string, unknown> }).properties ?? {};
    const events = Array.isArray(properties.events) ? properties.events : [];
    const description = events
      .map((event) => (event && typeof event === 'object' && typeof (event as { description?: unknown }).description === 'string' ? (event as { description: string }).description : ''))
      .filter(Boolean)
      .slice(0, 1)
      .join('');
    return [
      {
        category: typeof properties.iconCategory === 'string' ? properties.iconCategory : null,
        delaySeconds: typeof properties.delay === 'number' ? properties.delay : null,
        description: description || null,
        lengthMeters: typeof properties.length === 'number' ? properties.length : null,
      },
    ];
  });
}

function kmhToMps(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value / 3.6 : null;
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

async function defaultTrafficFetch(url: string, timeoutMs: number): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  const text = await response.text();
  if (!text) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: null };
  }
}
