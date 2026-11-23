import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { sendEmail, smtpErrorDetails } from "../mailer.js";
import {
  validate,
  adminCreateSchema,
  resendPasswordSchema,
  statusSchema,
} from "../validation.js";
import {
  findUserById,
  listUsers,
  loadOrganizationsForSignIn,
  logAudit,
  nextUserId,
  publicUser,
  requireAuth,
  requirePasswordChangeComplete,
  requireRole,
  saveUser,
  studentCanSignIn,
} from "../middleware/auth.js";

const router = Router();
const validText = (value, max = 254) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;

function adminPasswordEmail(user, password) {
  const appUrl =
    process.env.FRONTEND_URL ||
    process.env.CLIENT_ORIGIN?.split(",")[0]?.trim() ||
    "http://localhost:5173";
  return {
    to: user.email,
    subject: "Your Campus Serve Admin account",
    text: `Hello ${user.first},\n\nA Campus Serve Admin account has been created for ${user.college}.\n\nSign in at ${appUrl} with this email address and temporary password:\n\nEmail: ${user.email}\nTemporary password: ${password}\n\nYou will be required to change this password before using the portal. Do not share this email or password.\n`,
  };
}

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

router.get("/", requireAuth, requirePasswordChangeComplete, async (_req, res, next) => {
  try {
    res.json({ users: (await listUsers()).map(publicUser) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, requirePasswordChangeComplete, requireRole("Super Admin"), validate(adminCreateSchema), async (req, res, next) => {
  try {
    const { email, password, last, first, mi, college } = req.body || {};
    if (
      !validText(email) ||
      !/^[^\s@]+@wmsu\.edu\.ph$/i.test(email.trim()) ||
      !validText(last, 100) ||
      !validText(first, 100) ||
      !validText(college, 200)
    )
      return res.status(400).json({ error: "Complete every required field with a valid value." });

    const normalizedEmail = email.trim().toLowerCase();
    const users = await listUsers();
    if (users.some((user) => user.email?.toLowerCase() === normalizedEmail))
      return res.status(409).json({ error: "An account with this email already exists." });
    if (users.some((user) => user.role === "Admin" && user.college === college))
      return res.status(409).json({ error: `${college} already has an Admin account.` });
    const organization = (await loadOrganizationsForSignIn()).find(
      (item) => item.name === college && item.status === "Active",
    );
    if (!organization)
      return res.status(400).json({ error: "Choose an active college or office." });

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
      orgType: organization.type,
      passwordHash: await bcrypt.hash(password, 12),
      sessionVersion: 0,
      mustChangePassword: true,
      status: "Active",
    };
    await pool.query(
      `INSERT INTO portal_users
        (id, role, last, first, mi, idno, email, college, org_type,
         password_hash, session_version, status, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
        user.mustChangePassword,
      ],
    );

    // Delivery is best-effort. The Super Admin keeps the generated password on
    // screen and can hand it over directly when the message never arrives, so
    // a mail outage must not prevent the account from being created.
    let emailSent = false;
    try {
      await sendEmail(adminPasswordEmail(user, password));
      emailSent = true;
    } catch (error) {
      console.error("Admin account email delivery failed:", JSON.stringify(smtpErrorDetails(error)));
      if (process.env.NODE_ENV !== "production")
        console.warn(`[DEV ADMIN PASSWORD] ${normalizedEmail}: ${password}`);
    }

    await logAudit(req, "user_create", user.id);
    res.status(201).json({ user: publicUser(user), emailSent });
  } catch (error) {
    next(error);
  }
});

// Retry delivery for the one-time password still shown to the Super Admin.
// Nothing is stored here: the account keeps only the bcrypt hash of the password.
router.post(
  "/resend-password",
  requireAuth,
  requirePasswordChangeComplete,
  requireRole("Super Admin"),
  validate(resendPasswordSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = (await listUsers()).find(
        (item) => item.role === "Admin" && item.email === email,
      );
      if (!user || !user.mustChangePassword)
        return res.status(404).json({ error: "Admin account not found." });
      await sendEmail(adminPasswordEmail(user, password));
      await logAudit(req, "admin_password_email_resend", user.id);
      res.json({ emailSent: true });
    } catch (error) {
      console.error("Resend Admin password email failed:", JSON.stringify(smtpErrorDetails(error)));
      res.status(502).json({ error: "Email delivery failed. Check SMTP settings and try again." });
    }
  },
);

router.patch("/:id", requireAuth, requirePasswordChangeComplete, requireRole("Admin", "Super Admin"), validate(statusSchema), async (req, res, next) => {
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

router.delete("/:id", requireAuth, requirePasswordChangeComplete, requireRole("Admin", "Super Admin"), async (req, res, next) => {
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
      await client.query(
        "SELECT set_config('app.actor_id', $1, true), set_config('app.actor_role', $2, true)",
        [String(req.user?.id ?? ""), String(req.user?.role ?? "")],
      );
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
router.get("/access-check/:id", requireAuth, requirePasswordChangeComplete, requireRole("Admin", "Super Admin"), async (req, res, next) => {
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
