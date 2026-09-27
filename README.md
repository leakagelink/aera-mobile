# Aera

Talk to your map. Phase 1 is a native Expo app for foreground location, MapLibre maps, Nominatim search, OSRM routing, and local trip recording.

MapLibre requires a development build. It does not run in Expo Go.

```bash
npm install
npx expo run:android
```

Copy `.env.example` to `.env.local` to override the public map, search, or routing endpoints. Do not commit secrets. The defaults use OpenFreeMap, Nominatim, and the public OSRM demo server.

Expo SDK 57 and React Native 0.86 always use the New Architecture, which MapLibre React Native 11 requires.
