CREATE TABLE IF NOT EXISTS app_records (
  collection TEXT NOT NULL CHECK (collection IN ('users', 'activities', 'enrollments', 'organizations')),
  record_id TEXT NOT NULL,
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, record_id)
);

CREATE OR REPLACE VIEW app_users AS
SELECT record_id,
  data->>'email' AS email,
  data->>'role' AS role,
  data->>'first' AS first_name,
  data->>'last' AS last_name,
  data->>'idno' AS id_number,
  data->>'college' AS college,
  data->>'status' AS status,
  updated_at
FROM app_records
WHERE collection = 'users';
