-- Dedicated user table for the Campus Serve portal. The database also contains
-- an unrelated legacy `users` table with UUID ids, so this app uses its own.
CREATE TABLE IF NOT EXISTS portal_users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('Super Admin', 'Admin', 'User')),
  last TEXT NOT NULL,
  first TEXT NOT NULL,
  mi TEXT NOT NULL DEFAULT '',
  idno TEXT NOT NULL,
  email TEXT NOT NULL,
  college TEXT NOT NULL,
  org_type TEXT,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_users_email_lower_key ON portal_users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS portal_users_idno_lower_key ON portal_users (lower(idno));
CREATE INDEX IF NOT EXISTS portal_users_college_idx ON portal_users (college);

CREATE TABLE IF NOT EXISTS portal_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP VIEW IF EXISTS app_users;
CREATE VIEW app_users AS
  SELECT id AS record_id, email, role, first AS first_name, last AS last_name,
         idno AS id_number, college, status, updated_at
  FROM portal_users;
