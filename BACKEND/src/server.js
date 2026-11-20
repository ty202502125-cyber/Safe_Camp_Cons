import "dotenv/config";
import app from "./app.js";
import pool from "./db.js";

const PORT = process.env.PORT || 5000;

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_records (
    collection TEXT NOT NULL CHECK (collection IN ('users', 'activities', 'enrollments', 'organizations')),
    record_id TEXT NOT NULL,
    data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection, record_id)
  )`);

  await pool.query(`CREATE OR REPLACE VIEW app_users AS
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
    WHERE collection = 'users'`);

  app.listen(PORT, "127.0.0.1", () =>
    console.log(`API listening at http://127.0.0.1:${PORT}`),
  );

} catch (error) {
  console.error(
    "Could not initialize PostgreSQL. Check BACKEND/.env and ensure the database exists.",
    error.message,
  );
  process.exitCode = 1;
  await pool.end();
}
