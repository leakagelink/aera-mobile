import { z } from 'zod';

const sampleSchema = z.object({
  timestamp: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
  accuracy: z.number().nullable(),
});

export const tripSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  durationSeconds: z.number(),
  distanceMeters: z.number(),
  averageSpeedMps: z.number(),
  maxSpeedMps: z.number(),
  sampleCount: z.number(),
  samples: z.array(sampleSchema),
  originName: z.string(),
  destinationName: z.string(),
  routeSummary: z.string(),
  recovered: z.boolean(),
});

export const tripListSchema = z.array(tripSchema);

export const tripDraftSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  originName: z.string(),
  destinationName: z.string(),
  routeSummary: z.string(),
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
