import { z } from 'zod';

const coordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const sampleSchema = z
  .object({
    timestamp: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().nullable(),
    speed: z.number().nullable(),
    heading: z.number().nullable(),
    altitude: z.number().nullable().optional(),
  })
  .transform((sample) => ({
    ...sample,
    altitude: sample.altitude ?? null,
  }));

export const tripSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  durationSeconds: z.number(),
  distanceMeters: z.number(),
  averageSpeedMps: z.number(),
  maxSpeedMps: z.number(),
  sampleCount: z.number(),
  movingTimeSeconds: z.number().optional(),
  stoppedTimeSeconds: z.number().optional(),
  samples: z.array(sampleSchema),
  originName: z.string(),
  destinationName: z.string(),
  routeSummary: z.string(),
  routeProvider: z.string().optional(),
  plannedGeometry: z.array(coordinateSchema).optional(),
  routeProgress: z.number().optional(),
  recovered: z.boolean(),
});

export const tripListSchema = z.array(tripSchema);

export const tripDraftSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  originName: z.string(),
  destinationName: z.string(),
  routeSummary: z.string(),
  routeProvider: z.string().optional(),
  plannedGeometry: z.array(coordinateSchema).optional(),
  samples: z.array(sampleSchema),
});

export const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string().optional(),
});

export const recentPlacesSchema = z.array(placeSchema);
