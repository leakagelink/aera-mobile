export type TrafficLevel = 'clear' | 'slow' | 'heavy';

type Flow = {
  currentSpeedMps: number | null;
  freeFlowSpeedMps: number | null;
  confidence: number | null;
  roadClosure: boolean | null;
};

export function trafficLevel(flow: Flow | null): TrafficLevel | null {
  if (!flow) return null;
  if (flow.roadClosure === true) return 'heavy';
  if (flow.confidence !== null && (!Number.isFinite(flow.confidence) || flow.confidence < 0.5)) return null;
  if (flow.currentSpeedMps === null || flow.freeFlowSpeedMps === null) return null;
  if (!Number.isFinite(flow.currentSpeedMps) || !Number.isFinite(flow.freeFlowSpeedMps) || flow.freeFlowSpeedMps <= 0) return null;
  const ratio = flow.currentSpeedMps / flow.freeFlowSpeedMps;
  if (ratio >= 0.8) return 'clear';
  if (ratio >= 0.5) return 'slow';
  return 'heavy';
}
