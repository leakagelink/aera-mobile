# Arah accounts

Production starts only with real user accounts. `NODE_ENV=production` together with `AUTH_MODE=development` still refuses to boot.

## Server configuration

Set these in `backend/.env` on the server. Do not commit the file.

- `NODE_ENV=production`
- `AUTH_MODE=jwt`
- `USER_JWT_SECRET` — at least 32 characters, different from the admin secret
- `ADMIN_JWT_SECRET` — at least 32 characters
- `AERA_SECRET_ENCRYPTION_KEY` — 32 bytes, base64 or hex
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` — the first admin, created on boot when the admin table is empty

Local development can keep `AUTH_MODE=development`. That mode attaches one fixed user and is rejected in production.

## Mobile accounts

- `POST /api/v1/auth/register` with `{ "email", "password" }`
- `POST /api/v1/auth/login` with the same body

The password is at least 10 characters and is stored as a bcrypt hash. The response is `{ "token", "user": { "id", "email" } }`. The phone sends `Authorization: Bearer <token>` on later API calls. The token is a user token. It cannot open the admin panel, and an admin token cannot open a user's trips.

Sign-in is rate limited to 10 attempts per IP each 15 minutes.

## Admin panel

The admin panel stays on its own cookie session at `/admin`. Provider API keys are saved there and encrypted. They are not part of the mobile account.

## Isolation

Trip, route, place, and assistant tools read the user id from the verified token. A model or client cannot pass another user's id.
