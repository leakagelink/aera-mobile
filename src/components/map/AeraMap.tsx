import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { lineCollection, pointFeature } from '@/components/map/geojson';
import { ErrorState } from '@/components/ui/States';
import { mapStyleProvider } from '@/services/providers';
import type { Coordinate } from '@/types/location';
import { usePrefersReducedMotion } from '@/theme/ReducedMotion';
import { useTheme } from '@/theme/useTheme';
import { paddedBounds } from '@/utils/geo';

export type MapRouteLine = {
  id: string;
  coordinates: Coordinate[];
  selected: boolean;
};

export type AeraMapHandle = {
  recenter: (longitude: number, latitude: number, zoom?: number, bearing?: number) => void;
  fit: (coordinates: Coordinate[]) => void;
};

type Props = {
  user?: Coordinate | null;
  destination?: Coordinate | null;
  routes?: MapRouteLine[];
  onUserGesture?: () => void;
};

export const AeraMap = forwardRef<AeraMapHandle, Props>(function AeraMap({ user, destination, routes = [], onUserGesture }, ref) {
  const theme = useTheme();
  const reduced = usePrefersReducedMotion();
  const cameraRef = useRef<CameraRef>(null);
  const loadedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    recenter(longitude, latitude, zoom = 16, bearing) {
      const duration = reduced ? 0 : 450;
      cameraRef.current?.easeTo({
        center: [longitude, latitude],
        zoom,
        duration,
        ...(typeof bearing === 'number' && Number.isFinite(bearing) ? { bearing } : {}),
      });
    },
    fit(coordinates) {
      const bounds = paddedBounds(coordinates);
      if (!bounds) return;
      cameraRef.current?.fitBounds(bounds, {
        padding: { top: 140, right: 40, bottom: 260, left: 40 },
        duration: reduced ? 0 : 550,
      });
    },
  }));

  useEffect(() => {
    loadedRef.current = false;
    setFailed(false);
    const timer = setTimeout(() => {
      if (!loadedRef.current) setFailed(true);
    }, 20_000);
    return () => clearTimeout(timer);
  }, [attempt]);

  if (Platform.OS === 'web') {
    return (
      <ErrorState
        title="Open Aera on a phone"
        message="The live map runs in the iOS and Android development build."
      />
    );
  }

  const selected = routes.filter((route) => route.selected);
  const alternatives = routes.filter((route) => !route.selected);
  const alternativeData = lineCollection(alternatives);
  const selectedData = lineCollection(selected);

  return (
    <View style={styles.fill}>
      <Map
        key={attempt}
        style={styles.fill}
        mapStyle={mapStyleProvider().styleUrl()}
        compass
        logo
        attribution
        attributionPosition={{ bottom: 108, left: 12 }}
        logoPosition={{ bottom: 108, right: 12 }}
        tintColor={theme.colors.primary}
        onRegionDidChange={(event) => {
          if (event.nativeEvent.userInteraction) onUserGesture?.();
        }}
        onDidFinishLoadingMap={() => {
          loadedRef.current = true;
          setFailed(false);
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
              paint={{ 'line-color': theme.colors.routeCasing, 'line-width': 10 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="route-selected-line"
              type="line"
              paint={{ 'line-color': theme.colors.primary, 'line-width': 5 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {destination ? (
          <GeoJSONSource id="destination" data={pointFeature(destination)}>
            <Layer
              id="destination-dot"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': theme.colors.warning,
                'circle-stroke-width': 3,
                'circle-stroke-color': theme.colors.hero,
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
