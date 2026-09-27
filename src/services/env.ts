import { z } from 'zod';

const DEFAULT_MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const DEFAULT_NOMINATIM = 'https://nominatim.openstreetmap.org';
const DEFAULT_USER_AGENT = 'AeraMobile/1.0 (https://github.com/leakagelink/aera-mobile)';
const DEFAULT_OSRM = 'https://router.project-osrm.org';

const urlSchema = z.url();

function readUrl(value: string | undefined, fallback: string): string {
  const parsed = urlSchema.safeParse(value?.trim());
  return (parsed.success ? parsed.data : fallback).replace(/\/$/, '');
}

function readText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export const env = {
  mapStyleUrl: readUrl(process.env.EXPO_PUBLIC_MAP_STYLE_URL, DEFAULT_MAP_STYLE),
  nominatimBaseUrl: readUrl(process.env.EXPO_PUBLIC_NOMINATIM_BASE_URL, DEFAULT_NOMINATIM),
  nominatimUserAgent: readText(process.env.EXPO_PUBLIC_NOMINATIM_USER_AGENT, DEFAULT_USER_AGENT),
  osrmBaseUrl: readUrl(process.env.EXPO_PUBLIC_OSRM_BASE_URL, DEFAULT_OSRM),
};
