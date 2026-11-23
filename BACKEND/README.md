# Backend API

The active API is the Express server in `src/`. It stores activities, enrollments and organizations in `app_records` (JSONB) and portal accounts in the dedicated `portal_users` table.

## Start locally

1. Create a PostgreSQL database (default name from `DB_NAME`).
2. Create a `.env` file in this folder with the settings used below. Keep it private.
3. From this folder, run `npm start` (or `npm run dev`). The frontend's Vite proxy sends `/api` requests to port 5000 by default.
4. Start the frontend with `cd ../FRONTEND; npm run dev`.
5. Check `http://localhost:5173/api/health`. It should return `database: "connected"`.

## Database schema and migrations

`src/migrate.js` applies the versioned SQL files in `migrations/` at startup and records them in `schema_migrations`. Existing accounts are copied once from `app_records` into `portal_users` with hashed passwords. The older `users` table in this database belongs to an unrelated UUID-based schema and is deliberately left untouched.

Passwords are stored as bcrypt hashes only. Email and ID number are unique (case-insensitive) at the database level. The `app_users` view exposes account metadata without credential fields for inspection in pgAdmin.

## Authentication

Login creates an 8-hour httpOnly cookie session. `/api/auth/me` restores the session on page load; `/api/auth/logout` revokes it. There is no token in browser storage. Students are additionally checked for an active Admin in their college. User mutations go through authenticated, role-scoped endpoints in `/api/users`; `/api/data` is also authenticated and does not expose users.

Student sign-up is two-step: `POST /api/auth/signup/request` emails a six-digit code to the WMSU address, then `POST /api/auth/register` creates the account only when that email and `code` are supplied. Codes are hashed in `signup_verifications`, expire after 10 minutes, allow five attempts, and are consumed when the account is created. Re-requesting is rate-limited to once per minute. In non-production the code is also printed in the API terminal (`[DEV SIGNUP CODE] ...`).

Password reset uses `POST /api/auth/password-reset/request` and `/api/auth/password-reset/confirm`. Reset codes are hashed in the database, expire after 10 minutes, and allow five verification attempts.

Creating an Admin through the Super Admin console generates a random temporary password, shows it once to the Super Admin, and emails it to the new Admin. The Admin must change it at first sign-in; protected API routes remain unavailable until the change succeeds. Email delivery is best-effort: a mail failure never blocks account creation. The response returns `emailSent`, so the UI can tell the Super Admin to share the password directly; in non-production the password is also printed in the API terminal (`[DEV ADMIN PASSWORD] ...`). `POST /api/users/resend-password` with the still-displayed `{ email, password }` retries delivery without changing the stored hash (Super Admin only). Working SMTP settings are still needed for the email itself, including during local development. Set `FRONTEND_URL` to the portal URL used in the email; it defaults to `CLIENT_ORIGIN` or `http://localhost:5173`.

For local password-reset testing, leave the `SMTP_*` values blank and keep `NODE_ENV=development`: the API prints the 6-digit reset code in its terminal (`[DEV PASSWORD RESET] ...`) instead of sending an email. Admin creation uses the same no-SMTP fallback in non-production but also keeps the password on screen for the Super Admin. Production requires real `SMTP_HOST`, `SMTP_USER` and `SMTP_APP_PASSWORD` (plus `SMTP_PORT`, `SMTP_SECURE` and optional `SMTP_FROM`); with Gmail, use a 2-Step Verification App Password, never the account password. Emailing a temporary password is less secure than an expiring setup link; the required first-login password change limits its lifetime but cannot protect the message while it is in the mailbox.

## Reports and analytics

`GET /api/reports/overview`, `GET /api/reports/colleges` and `GET /api/reports/colleges/:college` are Super Admin-only endpoints that return university-wide or per-college KPIs, monthly series, breakdowns and top activities. Supported query filters are `from`, `to` (YYYY-MM-DD), `category`, `status`, `college`, `asOf` (ISO timestamp) and `excludeTest` (default `true`). Responses are cached in memory for 30 seconds per filter set.

Migration `004_reporting_history.sql` adds `created_at` to `app_records`, an immutable `record_events` table, and triggers on `app_records` and `portal_users`. Every create, status change, attendance change, college/role change and deletion is recorded with an actor and timestamp, so reports can reconstruct state at a past `asOf` time instead of relying only on the current row. Deleted records remain in the event log and are excluded from current state but can appear in historical reconstructions.

Hours in reports count **only verified attendance** (`attended && verified`). Student submissions store `submittedAt`; Admin verification stores `verifiedAt` and `verifiedBy`, and re-submission clears them. Likely test/probe records are filtered by default; pass `excludeTest=false` to include them.

History tracking starts when migration `004` is applied. The migration seeds one initial snapshot per existing row, but transitions that happened **before** it cannot be reconstructed. Completion status is still derived from activity dates and `endTime`, not from a stored "completed" action.

## Security notes

- Set `JWT_SECRET` (required in production) and `SUPER_ADMIN_PASSWORD` (required before the first start); never reuse a demo password.
- TLS certificate verification is always on. Set `DB_CA_CERT` only if the database provider uses a private CA.
- Bind to `0.0.0.0` (`HOST`) only behind a TLS-terminating reverse proxy, and set `TRUST_PROXY=1` so rate limiting sees real client IPs. Use `COOKIE_SAME_SITE=none` only when the UI and API are on different sites (cookies require HTTPS).
- Security headers come from Helmet; rate limits apply to all `/api` traffic with a stricter limit on `/api/auth`. `/api/health` is exempt so monitoring probes never exhaust the shared per-IP budget.
- For local testing, set `RATE_LIMIT_SKIP=true` in `BACKEND/.env` to disable the limits, or set `RATE_LIMIT_LIMIT` to a higher number. Both are ignored in production. Restart the API after changing either; a restart also clears the current in-memory counters immediately.
- Security-relevant actions are recorded in `portal_audit_logs`.
