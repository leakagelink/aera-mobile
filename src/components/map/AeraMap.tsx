import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { lineCollection, namedPoints, pointFeature, trafficCollection } from '@/components/map/geojson';
import { ErrorState } from '@/components/ui/States';
import { mapStyleProvider } from '@/services/providers';
import type { Coordinate } from '@/types/location';
import type { Place } from '@/types/place';
import { usePrefersReducedMotion } from '@/theme/ReducedMotion';
import { useTheme } from '@/theme/useTheme';
import { paddedBounds } from '@/utils/geo';

export type MapRouteLine = {
  id: string;
  coordinates: Coordinate[];
  selected: boolean;
};

export type MapTrafficLine = {
  id: string;
  coordinates: Coordinate[];
  level: 'clear' | 'slow' | 'heavy';
};

export type AeraMapHandle = {
  recenter: (longitude: number, latitude: number, zoom?: number, bearing?: number) => void;
  fit: (coordinates: Coordinate[]) => void;
};

type Props = {
  user?: Coordinate | null;
  origin?: Coordinate | null;
  destination?: (Coordinate & { name?: string }) | null;
  nearby?: Place[];
  routes?: MapRouteLine[];
  traffic?: MapTrafficLine[];
  onUserGesture?: () => void;
};

export const AeraMap = forwardRef<AeraMapHandle, Props>(function AeraMap({ user, origin, destination, nearby = [], routes = [], traffic = [], onUserGesture }, ref) {
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();
  const cameraRef = useRef<CameraRef>(null);
  const loadedRef = useRef(false);
  const centeredRef = useRef(false);
  const pendingRef = useRef<{ kind: 'fit'; coordinates: Coordinate[] } | { kind: 'recenter'; longitude: number; latitude: number; zoom: number; bearing?: number } | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  function moveCamera(longitude: number, latitude: number, zoom: number, bearing?: number) {
    cameraRef.current?.easeTo({
      center: [longitude, latitude],
      zoom,
      duration: reduced ? 0 : 450,
      ...(typeof bearing === 'number' && Number.isFinite(bearing) ? { bearing } : {}),
    });
  }

  function fitCamera(coordinates: Coordinate[]) {
    const bounds = paddedBounds(coordinates);
    if (!bounds) return;
    cameraRef.current?.fitBounds(bounds, {
      padding: { top: 140, right: 40, bottom: 260, left: 40 },
      duration: reduced ? 0 : 550,
    });
  }

  useImperativeHandle(ref, () => ({
    recenter(longitude, latitude, zoom = 16, bearing) {
      if (!loadedRef.current) {
        pendingRef.current = { kind: 'recenter', longitude, latitude, zoom, bearing };
        return;
      }
      moveCamera(longitude, latitude, zoom, bearing);
    },
    fit(coordinates) {
      if (!loadedRef.current) {
        pendingRef.current = { kind: 'fit', coordinates };
        return;
      }
      fitCamera(coordinates);
    },
  }));

  useEffect(() => {
    loadedRef.current = false;
    centeredRef.current = false;
    setFailed(false);
    const timer = setTimeout(() => {
      if (!loadedRef.current) setFailed(true);
    }, 20_000);
    return () => clearTimeout(timer);
  }, [attempt]);

  if (Platform.OS === 'web') {
    return (
      <ErrorState
        title="Open Arah on a phone"
        message="The live map runs in the iOS and Android development build."
      />
    );
  }

  const selected = routes.filter((route) => route.selected);
  const alternatives = routes.filter((route) => !route.selected);
  const alternativeData = lineCollection(alternatives);
  const selectedData = lineCollection(selected);
  const trafficData = trafficCollection(traffic);
  const nearbyData = namedPoints(nearby);

  return (
    <View style={styles.fill}>
      <Map
        key={attempt}
        style={styles.fill}
        mapStyle={mapStyleProvider().styleUrl()}
        compass
        logo={false}
        attribution
        attributionPosition={{ bottom: 108, left: 12 }}
        tintColor={theme.colors.primary}
        onRegionDidChange={(event) => {
          if (event.nativeEvent.userInteraction) onUserGesture?.();
        }}
        onDidFinishLoadingMap={() => {
          loadedRef.current = true;
          setFailed(false);
          const pending = pendingRef.current;
          pendingRef.current = null;
          if (pending?.kind === 'fit') {
            centeredRef.current = true;
            fitCamera(pending.coordinates);
            return;
          }
          if (pending?.kind === 'recenter') {
            centeredRef.current = true;
            moveCamera(pending.longitude, pending.latitude, pending.zoom, pending.bearing);
            return;
          }
          const current = userRef.current;
          if (!current || centeredRef.current) return;
          centeredRef.current = true;
          cameraRef.current?.easeTo({ center: [current.longitude, current.latitude], zoom: 16, duration: 0 });
        }}
        onDidFailLoadingMap={() => setFailed(true)}
      >
        <Camera ref={cameraRef} minZoom={2} maxZoom={20} initialViewState={{ center: [0, 20], zoom: 2 }} />
        {alternativeData.features.length > 0 ? (
          <GeoJSONSource id="route-alternatives" data={alternativeData}>
            <Layer
              id="route-alternatives-line"
              type="line"
              paint={{ 'line-color': theme.colors.routeAlt, 'line-width': 4, 'line-opacity': 0.85 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {selectedData.features.length > 0 ? (
          <GeoJSONSource id="route-selected" data={selectedData}>
            <Layer
              id="route-selected-casing"
              type="line"
              paint={{ 'line-color': '#FFFFFF', 'line-width': 12, 'line-opacity': 0.95 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="route-selected-line"
              type="line"
              paint={{ 'line-color': '#0B6BFF', 'line-width': 7 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {trafficData.features.length > 0 ? (
          <GeoJSONSource id="route-traffic" data={trafficData}>
            <Layer
              id="route-traffic-line"
              type="line"
              paint={{
                'line-color': ['match', ['get', 'level'], 'clear', '#1F8A4C', 'slow', '#D89A00', 'heavy', '#D64545', '#0B6BFF'],
                'line-width': 7,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {origin ? (
          <GeoJSONSource id="origin" data={pointFeature(origin)}>
            <Layer
              id="origin-dot"
              type="circle"
              paint={{
                'circle-radius': 7,
                'circle-color': theme.colors.success,
                'circle-stroke-width': 3,
                'circle-stroke-color': theme.colors.hero,
              }}
            />
          </GeoJSONSource>
        ) : null}
        {destination ? (
          <GeoJSONSource id="destination" data={namedPoints([{ name: destination.name?.trim() || 'Yahan jana hai', latitude: destination.latitude, longitude: destination.longitude }])}>
            <Layer
              id="destination-dot"
              type="circle"
              paint={{
                'circle-radius': 11,
                'circle-color': '#E25B4A',
                'circle-stroke-width': 3,
                'circle-stroke-color': '#FFFFFF',
              }}
            />
            <Layer
              id="destination-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 14,
                'text-offset': [0, 1.1],
                'text-anchor': 'top',
                'text-max-width': 10,
              }}
              paint={{
                'text-color': '#1A2230',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 2,
              }}
            />
          </GeoJSONSource>
        ) : null}
        {nearbyData.features.length > 0 ? (
          <GeoJSONSource id="nearby" data={nearbyData}>
            <Layer
              id="nearby-dot"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': theme.colors.hero,
                'circle-stroke-width': 2,
                'circle-stroke-color': theme.colors.primary,
              }}
            />
            <Layer
              id="nearby-label"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-offset': [0, 0.9],
                'text-anchor': 'top',
                'text-max-width': 8,
              }}
              paint={{
                'text-color': theme.colors.hero,
                'text-halo-color': theme.colors.ink,
                'text-halo-width': 1,
              }}
            />
          </GeoJSONSource>
        ) : null}
        {user ? (
          <GeoJSONSource id="user" data={pointFeature(user)}>
            <Layer
              id="user-halo"
              type="circle"
              paint={{ 'circle-radius': 16, 'circle-color': theme.colors.primary, 'circle-opacity': 0.25 }}
            />
            <Layer
              id="user-dot"
              type="circle"
              paint={{
                'circle-radius': 7,
                'circle-color': theme.colors.primary,
                'circle-stroke-width': 3,
                'circle-stroke-color': theme.colors.hero,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
      {failed ? (
        <View style={[styles.failure, { backgroundColor: theme.colors.background }]}>
          <ErrorState
            title="Map could not load"
            message="Check your connection, then try the map again."
            actionLabel="Try again"
            onAction={() => setAttempt((value) => value + 1)}
          />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  failure: { ...StyleSheet.absoluteFill },
});
