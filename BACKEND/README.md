# Backend API

The active API is the Express server in `src/`. It stores the frontend's users, activities, enrollments, and organizations in PostgreSQL. `schema.sql` describes the table; the server creates it at startup.

## Start locally

1. Create a PostgreSQL database (default name: `campus_connect`).
2. Copy `.env.example` to `.env` and enter your database connection details. Keep `.env` private.
3. From this folder, run `npm start` (or `npm run dev` when nodemon is installed).
4. Start the frontend with `cd ../FRONTEND; npm run dev`. The Vite proxy sends `/api` requests to port 5000 by default.
5. Check `http://localhost:5173/api/health`. It should return `database: "connected"`.

When PostgreSQL is unavailable, the frontend keeps its browser cache, and database save errors appear in the browser console. Once the API is reachable, reload to sync with PostgreSQL.

Login is checked against the API's `users` collection. Password reset uses `POST /api/auth/password-reset/request` and `POST /api/auth/password-reset/confirm`; configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_APP_PASSWORD`, and optionally `SMTP_FROM` in `BACKEND/.env` to enable email delivery. Reset codes expire after 10 minutes and are limited to five verification attempts. With Gmail, turn on 2-Step Verification and create an App Password for the backend sender account; use that App Password for `SMTP_APP_PASSWORD`, never your regular Gmail password.

In pgAdmin, user records live in the `app_records` table with `collection = 'users'`. The backend also creates the read-only `app_users` view so user accounts are easy to inspect under **Schemas → public → Views**. Query it with `SELECT * FROM app_users ORDER BY updated_at DESC;`.

The current UI is a local demo and has no authenticated API session. The API binds to `127.0.0.1` for local development; add real authentication and per-user authorization before exposing it to other machines or deploying it.
