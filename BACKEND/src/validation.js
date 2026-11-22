import { z } from "zod";

const wmsuEmail = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .regex(/@wmsu\.edu\.ph$/i, "Use your WMSU email address.")
  .transform((value) => value.toLowerCase());

const name = z.string().trim().min(1, "Required.").max(100);
const password = z.string().min(8, "Password must be at least 8 characters.");

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: wmsuEmail,
  code: z.string().regex(/^\d{6}$/, "Enter the six-digit verification code."),
  password,
  last: name,
  first: name,
  mi: z.string().trim().max(2).optional().default("").transform((v) => v.replace(/\./g, "")),
  idno: name,
  college: z.string().trim().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

export const signupRequestSchema = z.object({
  email: wmsuEmail,
});

export const resetRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((v) => v.toLowerCase()),
});

export const resetConfirmSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((v) => v.toLowerCase()),
  code: z.string().regex(/^\d{6}$/, "Enter the six-digit code."),
  password,
});

export const adminCreateSchema = z.object({
  email: wmsuEmail,
  password: z.string().regex(/^[A-Za-z0-9_-]{32}$/, "Generate a valid temporary password."),
  last: name,
  first: name,
  mi: z.string().trim().max(2).optional().default("").transform((v) => v.replace(/\./g, "")),
  college: z.string().trim().min(1).max(200),
  orgType: z.string().trim().max(100).optional(),
});

export const resendPasswordSchema = z.object({
  email: wmsuEmail,
  password: z.string().regex(/^[A-Za-z0-9_-]{32}$/, "Generate a valid temporary password."),
});

export const statusSchema = z.object({
  status: z.enum(["Active", "Inactive"]),
});

const reportDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .optional();

export const reportQuerySchema = z.object({
  from: reportDate,
  to: reportDate,
  category: z.string().trim().max(100).optional(),
  status: z.string().trim().max(40).optional(),
  college: z.string().trim().max(150).optional(),
  asOf: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Use a valid date.")
    .optional(),
  excludeTest: z.enum(["true", "false"]).optional(),
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success)
      return res
        .status(400)
        .json({ error: result.error.issues[0]?.message || "Invalid request." });
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success)
      return res
        .status(400)
        .json({ error: result.error.issues[0]?.message || "Invalid query." });
    req.reportQuery = result.data;
    next();
  };
}
