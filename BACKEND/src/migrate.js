import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import pool from "./db.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    last: row.last,
    first: row.first,
    mi: row.mi || "",
    idno: row.idno,
    email: row.email,
    college: row.college,
    ...(row.org_type ? { orgType: row.org_type } : {}),
    passwordHash: row.password_hash,
    sessionVersion: row.session_version,
    mustChangePassword: row.must_change_password === true,
    status: row.status,
    nickname: row.nickname || "",
    avatarData: row.avatar_data || "",
    coverData: row.cover_data || "",
  };
}

async function migrateLegacyUsers() {
  const result = await pool.query(
    "SELECT record_id, data FROM app_records WHERE collection = 'users'",
  );
  for (const row of result.rows) {
    const user = row.data;
    const id = Number(row.record_id);
    if (!Number.isInteger(id)) continue;
    const passwordHash =
      user.passwordHash ||
      (typeof user.pw === "string" ? await bcrypt.hash(user.pw, 12) : null);
    if (!passwordHash) continue;
    try {
      await pool.query(
        `INSERT INTO portal_users
          (id, role, last, first, mi, idno, email, college, org_type,
           password_hash, session_version, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          user.role,
          user.last || "",
          user.first || "",
          user.mi || "",
          user.idno || `USR-${id}`,
          user.email || `user-${id}@wmsu.edu.ph`,
          user.college || "",
          user.orgType || null,
          passwordHash,
          Number(user.sessionVersion || 0),
          user.status === "Inactive" ? "Inactive" : "Active",
        ],
      );
    } catch (error) {
      console.warn(`Skipped legacy user ${id}: ${error.message}`);
    }
  }
}

export async function runMigrations() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [file],
    );
    if (applied.rowCount) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  await migrateLegacyUsers();
}
