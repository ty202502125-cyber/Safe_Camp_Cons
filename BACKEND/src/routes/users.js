import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { validate, adminCreateSchema, statusSchema } from "../validation.js";
import {
  findUserById,
  listUsers,
  loadOrganizationsForSignIn,
  logAudit,
  nextUserId,
  publicUser,
  requireAuth,
  requireRole,
  saveUser,
  studentCanSignIn,
} from "../middleware/auth.js";

const router = Router();
const validText = (value, max = 254) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;

// Public information needed by the sign-up form; does not expose user records.
router.get("/eligible-colleges", async (_req, res, next) => {
  try {
    const users = await listUsers();
    const organizations = await loadOrganizationsForSignIn();
    const colleges = organizations
      .filter((org) => org.type === "College" && org.status === "Active")
      .map((org) => org.name)
      .filter((name) =>
        users.some(
          (user) =>
            user.role === "Admin" && user.status === "Active" && user.college === name,
        ),
      );
    res.json({ colleges });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    res.json({ users: (await listUsers()).map(publicUser) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requireRole("Super Admin"), validate(adminCreateSchema), async (req, res, next) => {
  try {
    const { email, password, last, first, mi, college, orgType } = req.body || {};
    if (
      !validText(email) ||
      !/^[^\s@]+@wmsu\.edu\.ph$/i.test(email.trim()) ||
      !validText(last, 100) ||
      !validText(first, 100) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !validText(college, 200)
    )
      return res.status(400).json({ error: "Complete every required field with a valid value." });

    const normalizedEmail = email.trim().toLowerCase();
    const users = await listUsers();
    if (users.some((user) => user.email?.toLowerCase() === normalizedEmail))
      return res.status(409).json({ error: "An account with this email already exists." });
    if (users.some((user) => user.role === "Admin" && user.college === college))
      return res.status(409).json({ error: `${college} already has an Admin account.` });

    const id = await nextUserId();
    const user = {
      id,
      role: "Admin",
      last: last.trim(),
      first: first.trim(),
      mi: typeof mi === "string" ? mi.trim().replace(/\./g, "") : "",
      idno: "OFF-" + String(id).padStart(4, "0"),
      email: normalizedEmail,
      college,
      orgType,
      passwordHash: await bcrypt.hash(password, 12),
      sessionVersion: 0,
      status: "Active",
    };
    await pool.query(
      `INSERT INTO portal_users
        (id, role, last, first, mi, idno, email, college, org_type,
         password_hash, session_version, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        user.id,
        user.role,
        user.last,
        user.first,
        user.mi,
        user.idno,
        user.email,
        user.college,
        user.orgType || null,
        user.passwordHash,
        user.sessionVersion,
        user.status,
      ],
    );
    await logAudit(req, "user_create", user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, requireRole("Admin", "Super Admin"), validate(statusSchema), async (req, res, next) => {
  try {
    const record = await findUserById(req.params.id);
    const target = record;
    if (!target) return res.status(404).json({ error: "Account not found." });

    const isSuper = req.user.role === "Super Admin";
    if (!isSuper && !(target.role === "User" && target.college === req.user.college))
      return res.status(403).json({ error: "You can only manage students in your own college." });
    if (Number(target.id) === Number(req.user.id))
      return res.status(400).json({ error: "You cannot change your own account here." });

    const { status } = req.body || {};
    if (status !== "Active" && status !== "Inactive")
      return res.status(400).json({ error: "Status must be Active or Inactive." });

    const updated = { ...target, status };
    await saveUser(updated);
    await logAudit(req, "user_status", target.id);
    res.json({ user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("Admin", "Super Admin"), async (req, res, next) => {
  try {
    const record = await findUserById(req.params.id);
    const target = record;
    if (!target) return res.status(404).json({ error: "Account not found." });

    const isSuper = req.user.role === "Super Admin";
    if (!isSuper && !(target.role === "User" && target.college === req.user.college))
      return res.status(403).json({ error: "You can only manage students in your own college." });
    if (Number(target.id) === Number(req.user.id))
      return res.status(400).json({ error: "You cannot delete your own account." });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM portal_users WHERE id = $1", [target.id]);
      await client.query(
        "DELETE FROM app_records WHERE collection = 'enrollments' AND data->>'userId' = $1",
        [String(target.id)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await logAudit(req, "user_delete", target.id);
    res.json({ message: "Account deleted." });
  } catch (error) {
    next(error);
  }
});

// Guard against a student losing portal access when their last college Admin is removed.
router.get("/access-check/:id", requireAuth, requireRole("Admin", "Super Admin"), async (req, res, next) => {
  try {
    const record = await findUserById(req.params.id);
    if (!record) return res.status(404).json({ error: "Account not found." });
    const users = await listUsers();
    const updated = users.map((user) =>
      Number(user.id) === Number(record.id) ? { ...user, status: "Inactive" } : user,
    );
    res.json({ signInAllowed: studentCanSignIn(record, updated, await loadOrganizationsForSignIn()) });
  } catch (error) {
    next(error);
  }
});

export default router;
