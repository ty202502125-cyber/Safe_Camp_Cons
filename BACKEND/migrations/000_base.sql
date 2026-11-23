-- Core record store for activity, enrollment and organization data.
-- User records were moved to a dedicated table in 001_users.sql.
CREATE TABLE IF NOT EXISTS app_records (
  collection TEXT NOT NULL CHECK (collection IN ('users', 'activities', 'enrollments', 'organizations', 'academicYears')),
  record_id TEXT NOT NULL,
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, record_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  email TEXT PRIMARY KEY,
  code_hash BYTEA NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
