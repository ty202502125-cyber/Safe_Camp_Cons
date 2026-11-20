import express from "express";
import cors from "cors";
import pool from "./db.js";
import dataRouter from "./routes/data.js";
import authRouter from "./routes/auth.js";

const app = express();

// Configure CORS to allow requests from the React frontend.
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim()),
  }),
);

// Middleware to parse incoming JSON requests.
app.use(express.json({ limit: "25mb" }));
app.use("/api/auth", authRouter);

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
