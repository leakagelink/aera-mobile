export function rerouteDecision(input: {
  offRoute: boolean;
  accuracy: number | null;
  locationAgeMs: number;
  offSince: number | null;
  now: number;
  lastAttemptAt: number | null;
}): { offSince: number | null; attempt: boolean } {
  const accurate = input.accuracy !== null && input.accuracy <= 50;
  const fresh = input.locationAgeMs >= 0 && input.locationAgeMs <= 20_000;
  if (!input.offRoute || !accurate || !fresh) return { offSince: null, attempt: false };
  const since = input.offSince ?? input.now;
  const cooled = input.lastAttemptAt === null || input.now - input.lastAttemptAt > 30_000;
  return { offSince: since, attempt: input.now - since >= 8_000 && cooled };
}

export function hasArrived(remainingMeters: number, offRoute: boolean, accuracy: number | null): boolean {
  return !offRoute && remainingMeters <= 40 && (accuracy === null || accuracy <= 50);
}

export function gpsWarning(accuracy: number | null, locationAgeMs: number): string | null {
  if (locationAgeMs > 15_000) return 'GPS signal nahi mil raha. Nayi location ka intezaar hai.';
  if (accuracy !== null && accuracy > 80) return 'GPS kamzor hai. Map par jagah thodi hil sakti hai.';
  return null;
}
