export type Coordinate = {
  latitude: number;
  longitude: number;
};

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const earth = 6_371_000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineStringWkt(points: Coordinate[]): string | null {
  if (points.length < 2) return null;
  const body = points.map((point) => `${formatOrdinate(point.longitude)} ${formatOrdinate(point.latitude)}`).join(', ');
  return `SRID=4326;LINESTRING(${body})`;
}

function formatOrdinate(value: number): string {
  if (!Number.isFinite(value)) throw new Error('Coordinate is not finite.');
  return value.toFixed(7);
}
