# Arah

Talk to your map. Arah is AI-powered maps, navigation and travel intelligence: a native Expo app for foreground location, MapLibre maps, place search, driving routes, and local trip recording.

MapLibre requires a development build. It does not run in Expo Go.

```bash
npm install
npx expo run:android
```

Copy `.env.example` to `.env.local` to override the map style, geocoding, or routing endpoints. Screens talk to provider interfaces, so those URLs can later point at an Arah-hosted search or routing service. Do not commit secrets. The defaults use OpenFreeMap, Nominatim, and the public OSRM demo server. OpenStreetMap data is used through those services; the map keeps its attribution.

Expo SDK 57 and React Native 0.86 always use the New Architecture, which MapLibre React Native 11 requires.

The API lives in `backend/` and is separate from the Expo app. It is a NestJS service for PostgreSQL/PostGIS and Redis, meant to run on a normal Linux VPS. The phone keeps using direct map, search, and routing providers until `EXPO_PUBLIC_AERA_API_BASE_URL` is set. See `backend/.env.example` for local Docker Compose settings. Do not commit real passwords.

Weather is requested from the Arah API only when a caller asks for it. The phone never receives an OpenWeather key. The assistant calls Gemini only from the API, and Gemini can use registered Arah tools for location, routes, trips, weather, and traffic. Provider setup, admin sign-in, and encryption are documented in `backend/docs/PROVIDER_CONFIGURATION.md`. The assistant, its tools, and its limits are documented in `backend/docs/AI.md`. Production accounts are documented in `backend/docs/AUTH.md`. The admin panel is served at `/admin` on the API.
