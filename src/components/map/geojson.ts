import type { Coordinate } from '@/types/location';

export type LineStringFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
};

export type PointFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
};

export type LineCollection = {
  type: 'FeatureCollection';
  features: LineStringFeature[];
};

export function trafficCollection(lines: { coordinates: Coordinate[]; level: string }[]) {
  return {
    type: 'FeatureCollection' as const,
    features: lines
      .filter((line) => line.coordinates.length >= 2)
      .map((line) => ({
        type: 'Feature' as const,
        properties: { level: line.level },
        geometry: {
          type: 'LineString' as const,
          coordinates: line.coordinates.map((coordinate) => [coordinate.longitude, coordinate.latitude] as [number, number]),
        },
      })),
  };
}

export function lineCollection(lines: { coordinates: Coordinate[] }[]): LineCollection {
  return {
    type: 'FeatureCollection',
    features: lines
      .filter((line) => line.coordinates.length >= 2)
      .map((line) => ({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: line.coordinates.map((coordinate) => [coordinate.longitude, coordinate.latitude]),
        },
      })),
  };
}

export type NamedPointCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { name: string };
    geometry: { type: 'Point'; coordinates: [number, number] };
  }[];
};

export function namedPoints(points: { name: string; latitude: number; longitude: number }[]): NamedPointCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      properties: { name: point.name },
      geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
    })),
  };
}

export function pointFeature(coordinate: Coordinate): PointFeature {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Point',
      coordinates: [coordinate.longitude, coordinate.latitude],
    },
  };
}
