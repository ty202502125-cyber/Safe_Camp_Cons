import { Router } from "express";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import pool from "../db.js";

const router = Router();
const resetCodes = new Map();
const hashCode = (code) => createHash("sha256").update(code).digest();
const validText = (value, max = 254) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;

async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT record_id, data FROM app_records WHERE collection = 'users' AND lower(data->>'email') = $1 LIMIT 1",
    [email],
  );
  return result.rows[0] || null;
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!validText(email) || typeof password !== "string")
      return res.status(400).json({ error: "Email and password are required." });
    const record = await findUserByEmail(email.trim().toLowerCase());
    const user = record?.data;
    if (!user || user.status !== "Active" || user.pw !== password)
      return res.status(401).json({ error: "Email or password is incorrect." });
    res.json({ userId: user.id, role: user.role });
  } catch (error) {
    next(error);
  }
});

router.post("/password-reset/request", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!validText(email)) return res.status(400).json({ error: "Enter your email address." });
    const normalizedEmail = email.trim().toLowerCase();
    const record = await findUserByEmail(normalizedEmail);
    if (!record) return res.status(404).json({ error: "No account uses that email address." });
    const previous = resetCodes.get(normalizedEmail);
    if (previous && Date.now() - previous.sentAt < 60_000)
      return res.status(429).json({ error: "Please wait one minute before requesting another code." });
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD)
      return res.status(503).json({ error: "Password reset email is not configured. Add SMTP settings to BACKEND/.env and restart the API." });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE.toLowerCase() === "true"
        : port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD.replace(/\s+/g, ""),
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: normalizedEmail,
        subject: "Campus Serve password reset code",
        text: `Your Campus Serve password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
      });
    } catch (error) {
      console.error("Password reset email delivery failed:", error.message);
      return res.status(502).json({ error: "The reset email could not be delivered. Check the SMTP settings and try again." });
    }
    resetCodes.set(normalizedEmail, {
      hash: hashCode(code),
      sentAt: Date.now(),
      expiresAt: Date.now() + 10 * 60_000,
      attempts: 0,
    });
    res.json({ message: "A reset code was sent to your email address." });
  } catch (error) {
    next(error);
  }
});

router.post("/password-reset/confirm", async (req, res, next) => {
  try {
    const { email, code, password } = req.body || {};
    if (!validText(email) || !/^\d{6}$/.test(code || "") || typeof password !== "string" || password.length < 8)
      return res.status(400).json({ error: "Enter your email, six-digit code, and a password of at least 8 characters." });
    const normalizedEmail = email.trim().toLowerCase();
    const pending = resetCodes.get(normalizedEmail);
    if (!pending || pending.expiresAt < Date.now() || pending.attempts >= 5) {
      resetCodes.delete(normalizedEmail);
      return res.status(400).json({ error: "That code is invalid or expired. Request a new code." });
    }
    const supplied = hashCode(code);
    if (!timingSafeEqual(supplied, pending.hash)) {
      pending.attempts += 1;
      return res.status(400).json({ error: "That code is incorrect." });
    }
    const record = await findUserByEmail(normalizedEmail);
    if (!record) {
      resetCodes.delete(normalizedEmail);
      return res.status(404).json({ error: "No account uses that email address." });
    }
    const updated = { ...record.data, pw: password };
    await pool.query(
      "UPDATE app_records SET data = $2::jsonb, updated_at = NOW() WHERE collection = 'users' AND record_id = $1",
      [record.record_id, JSON.stringify(updated)],
    );
    resetCodes.delete(normalizedEmail);
    res.json({ message: "Password updated. You can now log in with your new password." });
  } catch (error) {
    next(error);
  }
});

export default router;
