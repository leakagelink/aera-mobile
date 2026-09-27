# Arah assistant

The assistant runs on the Arah API. The phone sends a message to `POST /api/v1/ai/chat`. The API calls Gemini with a fixed list of Arah tools. Gemini never calls OpenWeather, TomTom, OSRM, or Nominatim itself, and it cannot choose an arbitrary URL.

```
Arah mobile
  -> POST /api/v1/ai/chat
  -> AiService
  -> Gemini
  -> ArahToolRegistry
  -> existing Arah services
  -> Gemini
  -> mobile
```

## Configuration

Gemini and TomTom are configured like the other providers.

- Admin panel: enable the provider, set the base URL, paste the API key, and run Test connection. The key is stored encrypted and only the last four characters are shown again.
- Environment fallback, used only when that provider has no database row:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL` (default `gemini-2.0-flash`)
  - `TOMTOM_API_KEY`

A disabled database row does not fall through to the environment key. None of these keys belong in Expo config or `EXPO_PUBLIC_*` variables.

## Authentication

`POST /api/v1/ai/chat` uses the same request user as the rest of the API. In development, `AUTH_MODE=development` attaches the fixed development user. In production, `AUTH_MODE=jwt` is required and the user id comes from the signed-in account's bearer token. The assistant does not accept a user id from Gemini. See `backend/docs/AUTH.md`.

## Request

```json
{
  "message": "What's the weather here?",
  "history": [{ "role": "user", "text": "Earlier question" }],
  "context": {
    "location": { "latitude": 0, "longitude": 0, "speed": 0, "timestamp": "2026-09-27T00:00:00.000Z" }
  }
}
```

`history` is optional and bounded. `context` is optional device state. The server does not store the conversation.

The response is `{ "message": "...", "toolCalls": [{ "name": "...", "status": "ok", "activity": "Checking weather..." }] }`. Tool arguments, raw geometry, and secrets are not returned.

## Tools

Only names registered in `ArahToolRegistry` can run. Arguments are checked against a strict JSON schema. Extra fields, including `userId`, are rejected.

| Tool | Data source | Unavailable result |
| --- | --- | --- |
| `getCurrentLocation` | Device context on this request | `LOCATION_UNAVAILABLE` |
| `getCurrentSpeed` | Device GPS speed on this request | `SPEED_UNAVAILABLE` |
| `searchPlace` | `PlacesService` | `AI_TOOL_EXECUTION_FAILED` |
| `calculateRoute` | `RoutesService.preview` (cached OSRM, not saved) | `ROUTE_UNAVAILABLE` |
| `getAlternativeRoutes` | Same preview, compared with the first route | `ROUTE_UNAVAILABLE` |
| `getETA` | Device navigation context, otherwise a real preview | `ROUTE_UNAVAILABLE` |
| `getTripStats` | Latest stored trip for the authenticated user | `TRIP_UNAVAILABLE` |
| `getTripHistory` | Stored trip summaries for the authenticated user | empty summary |
| `getRoadHistory` | Not implemented | `ROAD_HISTORY_NOT_AVAILABLE` |
| `getWeather` | `WeatherService` and the existing Redis cache | `WEATHER_PROVIDER_NOT_CONFIGURED` and the existing weather codes |
| `getTraffic` | `TrafficService` then TomTom | `TRAFFIC_PROVIDER_NOT_CONFIGURED` |

Avoid-tolls and avoid-highways are accepted as flags and reported as `not_supported`. They are not applied to OSRM. Route geometry is reduced to a point count plus the start and end before it reaches Gemini. Trip tools return summaries, not GPS samples.

`GET /api/v1/navigation/traffic` uses the same `TrafficService`. With TomTom unset it still returns `{ "available": false, "reason": "not_configured" }`. OSRM remains the base router.

## Limits

These environment values are optional:

- `AI_MAX_TOOL_ROUNDS` default 5, maximum 8
- `AI_MAX_MESSAGE_CHARS` default 2000
- `AI_MAX_CONTEXT_MESSAGES` default 8
- `AI_RATE_LIMIT_PER_MINUTE` default 12, keyed in Redis as `aera:rl:ai:<user id>`

Gemini output is capped at 800 tokens. Each request times out with the provider timeout. The same tool stops after three calls. Two rejected tool calls stop the loop. Tool results larger than 6000 characters are replaced with `AI_TOOL_EXECUTION_FAILED`.

## Errors

Assistant failures use stable codes: `GEMINI_NOT_CONFIGURED`, `GEMINI_AUTH_FAILED`, `GEMINI_RATE_LIMITED`, `GEMINI_TIMEOUT`, `GEMINI_UNAVAILABLE`, `AI_RATE_LIMITED`, `AI_MESSAGE_TOO_LARGE`, `AI_TOOL_NOT_FOUND`, `AI_TOOL_INVALID_ARGUMENTS`, and `AI_TOOL_EXECUTION_FAILED`. Responses do not include provider keys or raw provider bodies.

## Adding a tool

Add one entry to `ArahToolRegistry` with a name, description, user-facing activity, strict schema, and a call into an existing Arah service. Do not give the tool a user id argument. Read the user from the chat context. If the underlying data does not exist, return a code and leave the tool honest.
