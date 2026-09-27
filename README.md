# Aera

Talk to your map. Aera is a native Expo app for foreground location, MapLibre maps, place search, driving routes, and local trip recording.

MapLibre requires a development build. It does not run in Expo Go.

```bash
npm install
npx expo run:android
```

Copy `.env.example` to `.env.local` to override the map style, geocoding, or routing endpoints. Screens talk to provider interfaces, so those URLs can later point at an Aera-hosted search or routing service. Do not commit secrets. The defaults use OpenFreeMap, Nominatim, and the public OSRM demo server. OpenStreetMap data is used through those services; the map keeps its attribution.

Expo SDK 57 and React Native 0.86 always use the New Architecture, which MapLibre React Native 11 requires.
