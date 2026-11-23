import "dotenv/config";
import bcrypt from "bcryptjs";
import app from "./app.js";
import pool from "./db.js";
import { runMigrations } from "./migrate.js";

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "127.0.0.1";

process.on("unhandledRejection", (reason) =>
  console.error("Unhandled rejection:", reason),
);
process.on("uncaughtException", (error) =>
  console.error("Uncaught exception:", error),
);

async function ensureSuperAdmin() {
  const existing = await pool.query("SELECT 1 FROM portal_users LIMIT 1");
  if (existing.rowCount) return;

  const email = (
    process.env.SUPER_ADMIN_EMAIL || "superadmin@wmsu.edu.ph"
  ).trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password)
    throw new Error("SUPER_ADMIN_PASSWORD must be set before the first start.");

  const user = {
    id: 1,
    role: "Super Admin",
    last: "Admin",
    first: "System",
    mi: "S",
    idno: "SA-0001",
    email,
    college: "University Administration",
    passwordHash: await bcrypt.hash(password, 12),
    sessionVersion: 0,
    status: "Active",
  };
  await pool.query(
    `INSERT INTO portal_users
      (id, role, last, first, mi, idno, email, college, password_hash,
       session_version, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      user.id,
      user.role,
      user.last,
      user.first,
      user.mi,
      user.idno,
      user.email,
      user.college,
      user.passwordHash,
      user.sessionVersion,
      user.status,
    ],
  );
  console.log("Initial Super Admin account created.");
}

try {
  await runMigrations();
  await ensureSuperAdmin();

  const server = app.listen(PORT, HOST, () =>
    console.log(`API listening at http://${HOST}:${PORT}`),
  );
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE")
      console.error(
        `Port ${PORT} is already in use. Stop the other backend process (or change PORT in BACKEND/.env) and run npm start again.`,
      );
    else console.error("API server error:", error.message);
    process.exit(1);
  });
} catch (error) {
  console.error(
    "Could not initialize PostgreSQL. Check BACKEND/.env and ensure the database exists.",
    error.message,
  );
  process.exitCode = 1;
  await pool.end();
}
