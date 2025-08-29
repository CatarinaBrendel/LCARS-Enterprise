import express from "express";
import { getClient } from "../../database/db.js"; // adjust path if your db helper lives elsewhere

const router = express.Router();

/**
 * GET /engineering/snapshot
 * Returns one JSON payload shaped like your EngineeringTab expects.
 * Backed by v_engineering_snapshot (021_engineering_views.sql).
 */
router.get("/snapshot", async (req, res) => {
  try {
    const { rows } = await getClient("SELECT snapshot FROM v_engineering_snapshot");
    const snapshot = rows?.[0]?.snapshot || { ts: new Date().toISOString() };
    res.json(snapshot);
  } catch (err) {
    console.error("[engineering] snapshot error:", err);
    res.status(500).json({ error: "Failed to load engineering snapshot" });
  }
});

/**
 * GET /engineering/metrics
 * Time-series for a metric (for future charts).
 * Example: /engineering/metrics?system=warp_core&metric=output_mw&part=&since=2h&limit=500
 */
router.get("/metrics", async (req, res) => {
  const {
    system,
    metric,
    part = "",
    since = "24h",
    limit = 500
  } = req.query || {};

  if (!system || !metric) {
    return res.status(400).json({ error: "system and metric are required" });
  }

  // since supports simple intervals like “24h”, “2h”, “7d”
  const ivl = /^[0-9]+[smhd]$/.test(since) ? since : "24h";

  try {
    const { rows } = await pool.query(
      `
      SELECT id, ts, system, metric, part, value_num, value_text, unit, status
      FROM engineering_metric
      WHERE system = $1
        AND metric = $2
        AND COALESCE(part, '') = $3
        AND ts >= NOW() - ($4)::interval
      ORDER BY ts DESC
      LIMIT $5
      `,
      [system, metric, part, ivl, Math.min(Number(limit) || 500, 5000)]
    );
    res.json(rows);
  } catch (err) {
    console.error("[engineering] metrics error:", err);
    res.status(500).json({ error: "Failed to load metrics" });
  }
});

/**
 * GET /engineering/events
 * Recent incidents/automations for the Events list
 * Example: /engineering/events?system=eps&severity=warn&limit=50
 */
router.get("/events", async (req, res) => {
  const { system, severity, limit = 100 } = req.query || {};

  const params = [];
  const conds = [];
  if (system) { params.push(system); conds.push(`system = $${params.length}`); }
  if (severity) { params.push(severity); conds.push(`severity = $${params.length}`); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  try {
    const { rows } = await pool.query(
      `
      SELECT id, ts, system, severity, message, context
      FROM engineering_event
      ${where}
      ORDER BY ts DESC
      LIMIT $${params.length + 1}
      `,
      [...params, Math.min(Number(limit) || 100, 1000)]
    );
    res.json(rows);
  } catch (err) {
    console.error("[engineering] events error:", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

export default router;
