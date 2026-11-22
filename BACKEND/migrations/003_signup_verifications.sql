-- One-time codes emailed to students before their account is created.
CREATE TABLE IF NOT EXISTS signup_verifications (
  email TEXT PRIMARY KEY,
  code_hash BYTEA NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
