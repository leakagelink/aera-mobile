export type TrafficStatus = 'unknown';

export type TrafficSegment = {
  index: number;
  status: TrafficStatus;
};

export type TrafficReport = {
  available: false;
  reason: 'not_configured';
  segments: TrafficSegment[];
};
