import { Router } from "express";
import pool from "../db.js";

const router = Router();
const collections = new Set([
  "users",
  "activities",
  "enrollments",
  "organizations",
]);

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
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM app_records WHERE collection = $1", [
        collection,
      ]);
      for (let index = 0; index < records.length; index += 1) {
        await client.query(
          "INSERT INTO app_records (collection, record_id, data, updated_at) VALUES ($1, $2, $3::jsonb, NOW())",
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
