export type TripSample = {
  timestamp: number;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
};

export type Trip = {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  distanceMeters: number;
  averageSpeedMps: number;
  maxSpeedMps: number;
  sampleCount: number;
  samples: TripSample[];
  originName: string;
  destinationName: string;
  routeSummary: string;
  recovered: boolean;
};

export type TripDraft = {
  id: string;
  startedAt: number;
  originName: string;
  destinationName: string;
  routeSummary: string;
  samples: TripSample[];
};
