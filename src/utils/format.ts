export type UnitSystem = 'metric' | 'imperial';

export function formatDistance(meters: number, units: UnitSystem): string {
  const safe = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  if (units === 'imperial') {
    const feet = safe * 3.28084;
    if (feet < 1000) return `${Math.round(feet)} ft`;
    return `${(safe / 1609.344).toFixed(1)} mi`;
  }
  if (safe < 1000) return `${Math.round(safe)} m`;
  return `${(safe / 1000).toFixed(safe < 10_000 ? 1 : 0)} km`;
}

export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  if (safe < 45) return '< 1 min';
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours <= 0) return `${Math.max(1, Math.round(safe / 60))} min`;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function formatSpeed(metersPerSecond: number | null, units: UnitSystem): string {
  if (metersPerSecond === null || !Number.isFinite(metersPerSecond) || metersPerSecond < 0) return '—';
  if (units === 'imperial') return `${Math.round(metersPerSecond * 2.23694)}`;
  return `${Math.round(metersPerSecond * 3.6)}`;
}

export function speedUnit(units: UnitSystem): string {
  return units === 'imperial' ? 'mph' : 'km/h';
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function withinFilter(timestamp: number, filter: 'today' | 'week' | 'month' | 'all', now = Date.now()): boolean {
  if (filter === 'all') return true;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filter === 'today') return timestamp >= start.getTime();
  if (filter === 'week') {
    start.setDate(start.getDate() - 6);
    return timestamp >= start.getTime();
  }
  start.setDate(start.getDate() - 29);
  return timestamp >= start.getTime();
}
