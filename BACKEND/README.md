# Backend API

The active API is the Express server in `src/`. It stores activities, enrollments and organizations in `app_records` (JSONB) and portal accounts in the dedicated `portal_users` table.

## Start locally

1. Create a PostgreSQL database (default name from `DB_NAME`).
2. Copy `.env.example` to `.env` and enter real values. Keep `.env` private.
3. From this folder, run `npm start` (or `npm run dev`). The frontend's Vite proxy sends `/api` requests to port 5000 by default.
4. Start the frontend with `cd ../FRONTEND; npm run dev`.
5. Check `http://localhost:5173/api/health`. It should return `database: "connected"`.

## Database schema and migrations

`src/migrate.js` applies the versioned SQL files in `migrations/` at startup and records them in `schema_migrations`. Existing accounts are copied once from `app_records` into `portal_users` with hashed passwords. The older `users` table in this database belongs to an unrelated UUID-based schema and is deliberately left untouched.

Passwords are stored as bcrypt hashes only. Email and ID number are unique (case-insensitive) at the database level. The `app_users` view exposes account metadata without credential fields for inspection in pgAdmin.

## Authentication

Login creates an 8-hour httpOnly cookie session. `/api/auth/me` restores the session on page load; `/api/auth/logout` revokes it. There is no token in browser storage. Students are additionally checked for an active Admin in their college. All mutations go through authenticated, role-scoped endpoints in `/api/users`; the generic `/api/data` API no longer exposes users.

Password reset uses `POST /api/auth/password-reset/request` and `/api/auth/password-reset/confirm`. Reset codes are hashed in the database, expire after 10 minutes, and allow five verification attempts.

For local testing, leave the `SMTP_*` values blank and keep `NODE_ENV=development`: the API prints the 6-digit code in its terminal (`[DEV PASSWORD RESET] ...`) instead of sending an email. Production always requires real `SMTP_HOST`, `SMTP_USER` and `SMTP_APP_PASSWORD` (plus `SMTP_PORT`, `SMTP_SECURE` and optional `SMTP_FROM`); with Gmail, use a 2-Step Verification App Password, never the account password.

## Security notes

- Set `JWT_SECRET` (required in production) and `SUPER_ADMIN_PASSWORD` (required before the first start); never reuse a demo password.
- TLS certificate verification is always on. Set `DB_CA_CERT` only if the database provider uses a private CA.
- Bind to `0.0.0.0` (`HOST`) only behind a TLS-terminating reverse proxy, and set `TRUST_PROXY=1` so rate limiting sees real client IPs. Use `COOKIE_SAME_SITE=none` only when the UI and API are on different sites (cookies require HTTPS).
- Security headers come from Helmet; rate limits apply to all `/api` traffic with a stricter limit on `/api/auth`.
- Security-relevant actions are recorded in `portal_audit_logs`.
