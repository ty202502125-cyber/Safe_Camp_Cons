import { readFileSync } from "node:fs";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

// Certificate verification stays enabled. Only supply a custom CA when the
// provider uses a private CA that is not in Node's trust store.
function sslConfig() {
  if (process.env.DB_SSL !== "true") return undefined;
  const caPath = process.env.DB_CA_CERT;
  return {
    rejectUnauthorized: true,
    ...(caPath ? { ca: readFileSync(caPath, "utf8") } : {}),
  };
}

const pool = new Pool(
  connectionString
    ? { connectionString, ssl: sslConfig() }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: sslConfig(),
      },
);

pool.on("error", (error) =>
  console.error("Unexpected PostgreSQL pool error:", error.message),
);

export default pool;
