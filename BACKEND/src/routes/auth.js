import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import pool from "../db.js";
import { isSmtpConfigured, sendEmail, smtpErrorDetails } from "../mailer.js";
import {
  validate,
  loginSchema,
  registerSchema,
  signupRequestSchema,
  changePasswordSchema,
  resetRequestSchema,
  resetConfirmSchema,
} from "../validation.js";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  findUserByEmail,
  issueToken,
  listUsers,
  loadOrganizationsForSignIn,
  logAudit,
  nextUserId,
  publicUser,
  requireAuth,
  saveUser,
  sessionCookieOptions,
  studentCanSignIn,
} from "../middleware/auth.js";

const router = Router();
const hashCode = (code) => createHash("sha256").update(code).digest();
const validText = (value, max = 254) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const WMSU_EMAIL = /^[^\s@]+@wmsu\.edu\.ph$/i;

async function passwordMatches(user, password) {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

function sendSession(res, user) {
  res.cookie(SESSION_COOKIE, issueToken(user), sessionCookieOptions());
  res.json({ user: publicUser(user) });
}

router.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!validText(email) || typeof password !== "string")
      return res.status(400).json({ error: "Email and password are required." });

    const user = await findUserByEmail(email.trim().toLowerCase());
    if (
      !user ||
      user.status !== "Active" ||
      !(await passwordMatches(user, password)) ||
      !studentCanSignIn(user, await listUsers(), await loadOrganizationsForSignIn())
    )
      return res.status(401).json({ error: "Email or password is incorrect." });

    await logAudit(req, "login", user.id, user);
    sendSession(res, user);
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await saveUser({ ...req.user, sessionVersion: Number(req.user.sessionVersion || 0) + 1 });
    await logAudit(req, "logout", req.user.id);
    clearSessionCookie(res);
    res.json({ message: "Signed out." });
  } catch (error) {
    next(error);
  }
});

// Step 1 of student sign-up: prove the WMSU mailbox is reachable.
router.post("/signup/request", validate(signupRequestSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const users = await listUsers();
    if (users.some((user) => user.email?.toLowerCase() === email))
      return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });

    const previous = await pool.query(
      "SELECT sent_at FROM signup_verifications WHERE email = $1",
      [email],
    );
    if (previous.rows[0] && Date.now() - new Date(previous.rows[0].sent_at).getTime() < 60_000)
      return res.status(429).json({ error: "Please wait one minute before requesting another code." });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (isSmtpConfigured()) {
      try {
        await sendEmail({
          to: email,
          subject: "Your Campus Serve sign-up verification code",
          text: `Welcome to Campus Serve! Your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
        });
      } catch (error) {
        console.error("Sign-up verification email delivery failed:", JSON.stringify(smtpErrorDetails(error)));
        return res.status(502).json({ error: "The verification email could not be delivered. Check the SMTP settings and try again." });
      }
    } else if (process.env.NODE_ENV === "production")
      return res.status(503).json({ error: "Email verification is not configured. Add SMTP settings to BACKEND/.env and restart the API." });

    if (process.env.NODE_ENV !== "production")
      console.warn(`[DEV SIGNUP CODE] ${email}: ${code} (expires in 10 minutes)`);

    await pool.query(
      `INSERT INTO signup_verifications (email, code_hash, sent_at, expires_at, attempts)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '10 minutes', 0)
       ON CONFLICT (email) DO UPDATE SET code_hash = $2, sent_at = NOW(),
         expires_at = NOW() + INTERVAL '10 minutes', attempts = 0`,
      [email, Buffer.from(hashCode(code))],
    );
    res.json({ message: `A verification code was sent to ${email}. It expires in 10 minutes.` });
  } catch (error) {
    next(error);
  }
});

router.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, code, password, last, first, mi, idno, college } = req.body || {};
    if (
      !validText(email, 254) ||
      !WMSU_EMAIL.test(email.trim().toLowerCase()) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !validText(last, 100) ||
      !validText(first, 100) ||
      !validText(idno, 100) ||
      !validText(college, 200)
    )
      return res.status(400).json({ error: "Complete every required field with a valid value." });

    const normalizedEmail = email.trim().toLowerCase();
    const users = await listUsers();
    if (users.some((user) => user.email?.toLowerCase() === normalizedEmail))
      return res.status(409).json({ error: "An account with this email already exists." });
    if (
      users.some(
        (user) => user.idno?.toLowerCase() === idno.trim().toLowerCase(),
      )
    )
      return res.status(409).json({ error: "An account with this ID number already exists." });

    const pending = await pool.query(
      "SELECT code_hash, expires_at, attempts FROM signup_verifications WHERE email = $1",
      [normalizedEmail],
    );
    const codeRow = pending.rows[0];
    if (!codeRow || new Date(codeRow.expires_at).getTime() < Date.now() || codeRow.attempts >= 5) {
      await pool.query("DELETE FROM signup_verifications WHERE email = $1", [normalizedEmail]);
      return res.status(400).json({ error: "Your verification code is invalid or expired. Request a new one." });
    }
    if (!timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(codeRow.code_hash))) {
      await pool.query(
        "UPDATE signup_verifications SET attempts = attempts + 1 WHERE email = $1",
        [normalizedEmail],
      );
      return res.status(400).json({ error: "That verification code is incorrect." });
    }

    const candidate = { role: "User", college, status: "Active" };
    if (!studentCanSignIn(candidate, users, await loadOrganizationsForSignIn()))
      return res.status(403).json({ error: "Choose a college with an active Admin." });

    const user = {
      id: await nextUserId(),
      role: "User",
      last: last.trim(),
      first: first.trim(),
      mi: typeof mi === "string" ? mi.trim().replace(/\./g, "") : "",
      idno: idno.trim(),
      email: normalizedEmail,
      college: college.trim(),
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
    await pool.query("DELETE FROM signup_verifications WHERE email = $1", [normalizedEmail]);
    await logAudit(req, "register", user.id, user);
    sendSession(res, user);
  } catch (error) {
    next(error);
  }
});

router.post("/password/change", requireAuth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8)
      return res.status(400).json({ error: "Enter your current password and a new password of at least 8 characters." });
    if (!(await passwordMatches(req.user, currentPassword)))
      return res.status(401).json({ error: "Current password is incorrect." });

    const updated = {
      ...req.user,
      passwordHash: await bcrypt.hash(newPassword, 12),
      sessionVersion: Number(req.user.sessionVersion || 0) + 1,
      mustChangePassword: false,
    };
    await saveUser(updated);
    await logAudit(req, "password_change", req.user.id);
    sendSession(res, updated);
  } catch (error) {
    next(error);
  }
});

router.post("/password-reset/request", validate(resetRequestSchema), async (req, res, next) => {
  const generic = { message: "If that email has an account, a reset code has been sent." };
  try {
    const { email } = req.body || {};
    if (!validText(email))
      return res.status(400).json({ error: "Enter your email address." });
    const normalizedEmail = email.trim().toLowerCase();
    const record = await findUserByEmail(normalizedEmail);
    if (!record) return res.json(generic);

    const previous = await pool.query(
      "SELECT sent_at FROM password_resets WHERE email = $1",
      [normalizedEmail],
    );
    if (previous.rows[0] && Date.now() - new Date(previous.rows[0].sent_at).getTime() < 60_000)
      return res.status(429).json({ error: "Please wait one minute before requesting another code." });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const smtpConfigured = isSmtpConfigured();

    if (!smtpConfigured) {
      if (process.env.NODE_ENV === "production")
        return res.status(503).json({ error: "Password reset email is not configured. Add SMTP settings to BACKEND/.env and restart the API." });
      // Local testing fallback: print the code in the API terminal instead of
      // sending an email. Never enabled when NODE_ENV=production.
      console.warn(
        `[DEV PASSWORD RESET] Code for ${normalizedEmail}: ${code} (expires in 10 minutes)`,
      );
    } else {
      try {
        await sendEmail({
          to: normalizedEmail,
          subject: "Campus Serve password reset code",
          text: `Your Campus Serve password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
        });
      } catch (error) {
        console.error("Password reset email delivery failed:", error.message);
        return res.status(502).json({ error: "The reset email could not be delivered. Check the SMTP settings and try again." });
      }
    }

    await pool.query(
      `INSERT INTO password_resets (email, code_hash, sent_at, expires_at, attempts)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '10 minutes', 0)
       ON CONFLICT (email) DO UPDATE SET code_hash = $2, sent_at = NOW(),
         expires_at = NOW() + INTERVAL '10 minutes', attempts = 0`,
      [normalizedEmail, Buffer.from(hashCode(code))],
    );
    res.json(generic);
  } catch (error) {
    next(error);
  }
});

router.post("/password-reset/confirm", validate(resetConfirmSchema), async (req, res, next) => {
  try {
    const { email, code, password } = req.body || {};
    if (
      !validText(email) ||
      !/^\d{6}$/.test(code || "") ||
      typeof password !== "string" ||
      password.length < 8
    )
      return res.status(400).json({ error: "Enter your email, six-digit code, and a password of at least 8 characters." });
    const normalizedEmail = email.trim().toLowerCase();
    const pending = await pool.query(
      "SELECT code_hash, expires_at, attempts FROM password_resets WHERE email = $1",
      [normalizedEmail],
    );
    const row = pending.rows[0];
    if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= 5) {
      await pool.query("DELETE FROM password_resets WHERE email = $1", [normalizedEmail]);
      return res.status(400).json({ error: "That code is invalid or expired. Request a new code." });
    }
    if (!timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(row.code_hash))) {
      await pool.query(
        "UPDATE password_resets SET attempts = attempts + 1 WHERE email = $1",
        [normalizedEmail],
      );
      return res.status(400).json({ error: "That code is incorrect." });
    }

    const record = await findUserByEmail(normalizedEmail);
    if (!record) {
      await pool.query("DELETE FROM password_resets WHERE email = $1", [normalizedEmail]);
      return res.status(400).json({ error: "That code is invalid or expired. Request a new code." });
    }
    await saveUser({
      ...record,
      passwordHash: await bcrypt.hash(password, 12),
      sessionVersion: Number(record.sessionVersion || 0) + 1,
      mustChangePassword: false,
    });
    await pool.query("DELETE FROM password_resets WHERE email = $1", [normalizedEmail]);
    await logAudit(req, "password_reset", record.id, record);
    res.json({ message: "Password updated. You can now log in with your new password." });
  } catch (error) {
    next(error);
  }
});

export default router;
