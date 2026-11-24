import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pool from "./db.js";
import dataRouter from "./routes/data.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import reportsRouter from "./routes/reports.js";

const app = express();

if (process.env.TRUST_PROXY)
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

app.disable("x-powered-by");
app.use(helmet());

// Configure CORS to allow requests from the React frontend.
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim()),
    credentials: true,
  }),
);

// Middleware to parse incoming JSON requests.
// Activity photos are stored as resized data URLs. Allow many per activity.
app.use(express.json({ limit: "100mb" }));
app.use(cookieParser());

// Health checks are registered before the limiter so uptime monitors never
// consume the shared per-IP request budget and lock out real users.
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ success: true, database: "connected" });
  } catch (error) {
    res
      .status(503)
      .json({ success: false, database: "unavailable", error: error.message });
  }
});

// Developer testing controls. Production always uses the safe defaults below;
// these knobs only work when NODE_ENV is not "production".
const isProduction = process.env.NODE_ENV === "production";
const skipLimits = !isProduction && process.env.RATE_LIMIT_SKIP === "true";
const configuredLimit = Number(process.env.RATE_LIMIT_LIMIT);
const apiLimit =
  Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : isProduction ? 300 : 5000;
const authLimit = isProduction ? 20 : 200;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: apiLimit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) =>
    skipLimits || req.originalUrl?.split("?")[0] === "/api/health",
  message: { error: "Too many requests. Please wait a few minutes and try again." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authLimit,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => skipLimits,
  message: { error: "Too many sign-in or verification attempts. Please wait a few minutes and try again." },
});
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);

app.use("/api/data", dataRouter);

// Root route.
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Campus Connect API!",
    healthCheck: "/api/health",
  });
});

// Centralized JSON error handler. Without this, Express returns an HTML stack
// trace to the frontend, which then has to guess what went wrong.
app.use((error, _req, res, _next) => {
  const badJson = error?.type === "entity.parse.failed";
  const validStatus =
    Number.isInteger(error?.status) && error.status >= 400 && error.status < 600;
  let status = 500;
  let message = "Internal server error.";
  if (badJson) {
    status = 400;
    message = "Invalid JSON body.";
  } else if (validStatus) {
    status = error.status;
    message = error.message;
  } else {
    console.error("Unhandled API error:", error);
  }
  res.status(status).json({ error: message });
});

export default app;
