# Provider configuration

Arah keeps provider credentials on the server. The mobile app calls the Arah API and never receives an OpenWeather, Gemini, or TomTom key.

## Admin panel

With the API running, open `http://localhost:3000/admin`.

Sign-in uses an admin account created on startup. Set these in `backend/.env` before the first boot, then restart:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
- `ADMIN_JWT_SECRET` (at least 32 characters)

The password is hashed with bcrypt before it is stored. Login responses do not say whether the email exists. Login is rate limited. The session is an HttpOnly cookie.

Every admin route except login requires that session.

## Encryption

`AERA_SECRET_ENCRYPTION_KEY` is a 32-byte key, base64 or hex. Generate one locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

The key stays in the server environment. It is not written to PostgreSQL. Stored API keys use AES-256-GCM (`v1`, nonce, tag, ciphertext). Admin responses show `apiKeyConfigured` and `apiKeyLast4` only.

Leaving the API key field empty on save keeps the current key.

## OpenWeather

Fallback environment variables, used when no enabled database row exists:

- `OPENWEATHER_API_KEY`
- `OPENWEATHER_BASE_URL` (default `https://api.openweathermap.org`)

An enabled OpenWeather row in `provider_configs` overrides that fallback. A disabled row does not fall through to the environment key. A provider becomes the default for its type only after a successful connection test while it is enabled.

The admin test uses a fixed coordinate and does not use the admin's location.

## Weather API

```
GET /api/v1/weather/current?lat=22.7196&lng=75.8577
```

The response is Arah's weather model, not the raw provider payload. Results are cached in Redis for `WEATHER_CACHE_TTL_SECONDS` (default 600) under `weather:{latBucket}:{lngBucket}`. Coordinates are bucketed to two decimal places. A short Redis lock stops duplicate provider calls for the same bucket. The route is rate limited.

The phone calls this endpoint only when weather is requested. It does not call OpenWeather, and it does not attach a weather request to every GPS sample.

## Other providers

The same admin screens store Gemini, TomTom, OSRM, Nominatim, and Martin. OSRM and Nominatim keep the existing `ROUTING_BASE_URL`, `OSRM_BASE_URL`, `GEOCODING_BASE_URL`, and `NOMINATIM_BASE_URL` settings. Optional `GEMINI_API_KEY`, `TOMTOM_API_KEY`, `MAP_STYLE_URL`, and `MAP_TILE_BASE_URL` are server-side only.

Health checks run when an admin asks for them. They are not polled in the background. Gemini is not called except by that manual test, and it is not given a general HTTP tool.

## Adding a provider

Add a catalog entry with a provider slug and type, a probe that returns a fixed success or failure message, and a service that reads `ProviderConfigService` instead of calling the vendor directly. Do not put the secret in Expo config or logs.
