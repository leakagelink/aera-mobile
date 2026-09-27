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
