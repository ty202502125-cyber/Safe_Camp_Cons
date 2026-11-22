import { Router } from "express";
import pool from "../db.js";
import {
  requireAuth,
  requirePasswordChangeComplete,
} from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requirePasswordChangeComplete);
// User records are served only by authenticated /api/users and /api/auth
// endpoints. The generic data API is authenticated as well.
const collections = new Set([
  "activities",
  "enrollments",
  "organizations",
  "academicYears",
]);
const SEMESTERS = new Set(["1st Semester", "2nd Semester"]);
const SCHOOL_YEAR = /^\d{4}-\d{2}$/;

function academicYearError(records) {
  const years = new Set();
  let active = 0;
  for (const record of records) {
    if (
      !record.id ||
      typeof record.year !== "string" ||
      !SCHOOL_YEAR.test(record.year) ||
      !SEMESTERS.has(record.semester) ||
      !["Active", "Archived"].includes(record.status)
    )
      return "Academic years need an id, YYYY-YY year, semester and status.";
    if (years.has(record.year)) return "Each academic year must be unique.";
    years.add(record.year);
    if (record.status === "Active") active += 1;
  }
  if (active > 1) return "Only one academic year can be active.";
  return null;
}

router.get("/:collection", async (req, res, next) => {
  try {
    if (!collections.has(req.params.collection))
      return res.status(404).json({ error: "Unknown collection." });
    const result = await pool.query(
      "SELECT data FROM app_records WHERE collection = $1 ORDER BY record_id",
      [req.params.collection],
    );
    res.json({ records: result.rows.map((row) => row.data) });
  } catch (error) {
    next(error);
  }
});

router.put("/:collection", async (req, res, next) => {
  try {
    const { collection } = req.params;
    const records = req.body?.records;
    if (!collections.has(collection))
      return res.status(404).json({ error: "Unknown collection." });
    if (
      !Array.isArray(records) ||
      records.length > 10000 ||
      records.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          (item.id === undefined && !item.name),
      )
    ) {
      return res
        .status(400)
        .json({ error: "records must be an array of objects." });
    }
    const ids = records.map((item) => String(item.id ?? item.name));
    if (new Set(ids).size !== ids.length)
      return res
        .status(400)
        .json({ error: "Each record needs a unique id or name." });

    if (collection === "academicYears") {
      if (req.user?.role !== "Super Admin")
        return res
          .status(403)
          .json({ error: "Only the Super Admin can manage academic years." });
      const error = academicYearError(records);
      if (error) return res.status(400).json({ error });
    }
    if (collection === "activities") {
      const years = await pool.query(
        "SELECT data FROM app_records WHERE collection = 'academicYears'",
      );
      const archived = years.rows
        .map((row) => row.data)
        .filter((year) => year?.status === "Archived")
        .map((year) => year.year);
      const locked = records.find((item) => archived.includes(item.schoolYear));
      if (locked)
        return res.status(403).json({
          error: `Academic year ${locked.schoolYear} is archived and read-only.`,
        });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize whole-collection writes so two tabs cannot race between
      // removing stale records and upserting the incoming snapshot.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `app_records:${collection}`,
      ]);
      // Reporting triggers read this to attribute every change to an actor.
      await client.query(
        "SELECT set_config('app.actor_id', $1, true), set_config('app.actor_role', $2, true)",
        [String(req.user?.id ?? ""), String(req.user?.role ?? "")],
      );
      await client.query(
        "DELETE FROM app_records WHERE collection = $1 AND NOT (record_id = ANY($2::text[]))",
        [collection, ids],
      );
      for (let index = 0; index < records.length; index += 1) {
        await client.query(
          `INSERT INTO app_records (collection, record_id, data, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (collection, record_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [collection, ids[index], JSON.stringify(records[index])],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ records });
  } catch (error) {
    next(error);
  }
});

export default router;
