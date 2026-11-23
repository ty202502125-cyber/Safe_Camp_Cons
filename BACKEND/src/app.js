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
app.use(express.json({ limit: "25mb" }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a few minutes and try again." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in or verification attempts. Please wait a few minutes and try again." },
});
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);

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

app.use("/api/data", dataRouter);

// Root route.
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Campus Connect API!",
    healthCheck: "/api/health",
  });
});

export default app;
