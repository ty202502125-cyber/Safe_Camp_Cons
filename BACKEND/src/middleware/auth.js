import jwt from "jsonwebtoken";
import pool from "../db.js";
import { rowToUser } from "../migrate.js";

export const SESSION_COOKIE = "campus_session";
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("JWT_SECRET must be set in production.");
  return "local-development-only-change-me";
}

export function publicUser(user) {
  if (!user) return null;
  const { pw, passwordHash, sessionVersion, ...safe } = user;
  return safe;
}

export function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, ver: user.sessionVersion || 0 },
    jwtSecret(),
    { expiresIn: "8h" },
  );
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAME_SITE || "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    path: "/",
    sameSite: process.env.COOKIE_SAME_SITE || "strict",
  });
}

function tokenFrom(req) {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (cookieToken) return cookieToken;
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : null;
}

export async function findUserById(id) {
  const result = await pool.query("SELECT * FROM portal_users WHERE id = $1", [id]);
  return rowToUser(result.rows[0]);
}

export async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT * FROM portal_users WHERE lower(email) = $1 LIMIT 1",
    [email],
  );
  return rowToUser(result.rows[0]);
}

export async function listUsers() {
  const result = await pool.query("SELECT * FROM portal_users ORDER BY id");
  return result.rows.map(rowToUser);
}

export async function saveUser(record) {
  await pool.query(
    `UPDATE portal_users SET role = $2, last = $3, first = $4, mi = $5, idno = $6,
       email = $7, college = $8, org_type = $9, password_hash = $10,
       session_version = $11, status = $12, must_change_password = $13,
       updated_at = NOW()
     WHERE id = $1`,
    [
      record.id,
      record.role,
      record.last,
      record.first,
      record.mi || "",
      record.idno,
      record.email,
      record.college,
      record.orgType || null,
      record.passwordHash,
      Number(record.sessionVersion || 0),
      record.status,
      record.mustChangePassword === true,
    ],
  );
}

export async function nextUserId() {
  const result = await pool.query(
    "SELECT COALESCE(MAX(id), 0) + 1 AS id FROM portal_users",
  );
  return Number(result.rows[0].id);
}

export async function loadOrganizationsForSignIn() {
  const result = await pool.query(
    "SELECT data FROM app_records WHERE collection = 'organizations'",
  );
  return result.rows.map((row) => row.data);
}

// A student may only use the portal while an active Admin is assigned to their college.
export function studentCanSignIn(user, users, organizations) {
  if (user.role !== "User") return true;
  const org = organizations.find(
    (item) => item.name === user.college && item.type === "College" && item.status === "Active",
  );
  if (!org) return false;
  return users.some(
    (item) =>
      item.role === "Admin" &&
      item.status === "Active" &&
      item.college === user.college,
  );
}

export async function logAudit(req, action, targetId = null, actor = null) {
  const actorUser = actor || req.user;
  try {
    await pool.query(
      `INSERT INTO portal_audit_logs (actor_id, actor_role, action, target_id, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actorUser?.id || null,
        actorUser?.role || null,
        action,
        targetId === null ? null : String(targetId),
        req.ip || null,
        (req.get("user-agent") || "").slice(0, 300),
      ],
    );
  } catch (error) {
    console.error("Audit logging failed:", error.message);
  }
}

export async function requireAuth(req, res, next) {
  try {
    const token = tokenFrom(req);
    if (!token) return res.status(401).json({ error: "Authentication required." });

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret());
    } catch {
      return res.status(401).json({ error: "Invalid or expired session." });
    }

    const user = await findUserById(payload.sub);
    if (
      !user ||
      user.status !== "Active" ||
      Number(payload.ver || 0) !== Number(user.sessionVersion || 0) ||
      !studentCanSignIn(user, await listUsers(), await loadOrganizationsForSignIn())
    )
      return res.status(401).json({ error: "Your session is no longer valid." });

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: "You do not have permission to do that." });
    next();
  };
}

export function requirePasswordChangeComplete(req, res, next) {
  if (req.user?.mustChangePassword)
    return res.status(403).json({
      error: "Change your temporary password before continuing.",
    });
  next();
}
