export type AiPlaceCard = {
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  distanceMeters?: number;
};

export type AiCard =
  | { type: 'places'; places: AiPlaceCard[] }
  | { type: 'route'; name: string; summary: string; distanceMeters: number; durationSeconds: number; latitude: number; longitude: number };

export function cardsFromToolResult(result: unknown): AiCard[] {
  if (Array.isArray(result)) {
    const places = result.flatMap(placeCard);
    return places.length > 0 ? [{ type: 'places', places: places.slice(0, 5) }] : [];
  }
  if (!result || typeof result !== 'object') return [];
  const body = result as Record<string, unknown>;
  if (Array.isArray(body.places)) {
    const places = body.places.flatMap(placeCard);
    return places.length > 0 ? [{ type: 'places', places: places.slice(0, 5) }] : [];
  }
  if (Array.isArray(body.routes)) {
    const first = body.routes.find((route) => route && typeof route === 'object');
    const card = routeCard(first);
    return card ? [card] : [];
  }
  const single = routeCard(body);
  return single ? [single] : [];
}

function placeCard(value: unknown): AiPlaceCard[] {
  if (!value || typeof value !== 'object') return [];
  const place = value as { name?: unknown; latitude?: unknown; longitude?: unknown; address?: unknown; distanceMeters?: unknown };
  if (typeof place.name !== 'string' || typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return [];
  return [
    {
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      address: typeof place.address === 'string' ? place.address : null,
      ...(typeof place.distanceMeters === 'number' ? { distanceMeters: place.distanceMeters } : {}),
    },
  ];
}

function routeCard(value: unknown): AiCard | null {
  if (!value || typeof value !== 'object') return null;
  const route = value as { summary?: unknown; distanceMeters?: unknown; durationSeconds?: unknown; end?: unknown };
  if (typeof route.distanceMeters !== 'number' || typeof route.durationSeconds !== 'number') return null;
  const end = route.end && typeof route.end === 'object' ? (route.end as { latitude?: unknown; longitude?: unknown }) : null;
  if (!end || typeof end.latitude !== 'number' || typeof end.longitude !== 'number') return null;
  return {
    type: 'route',
    name: 'Route',
    summary: typeof route.summary === 'string' ? route.summary : 'Route',
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    latitude: end.latitude,
    longitude: end.longitude,
  };
}
