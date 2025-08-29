import express from "express";
import { query } from "../../database/db.js"; // same helper you use in tests

const router = express.Router();

function normalizeInterval(since = "24h") {
  const m = String(since).match(/^(\d+)([smhd])$/i);
  if (!m) return "24 hours";
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return unit === "s" ? `${n} seconds`
       : unit === "m" ? `${n} minutes`
       : unit === "h" ? `${n} hours`
       : /* d */        `${n} days`;
}

// GET /api/engineering/snapshot
router.get("/snapshot", async (_req, res) => {
  try {
    const { rows } = await query("SELECT snapshot FROM v_engineering_snapshot");
    res.json(rows?.[0]?.snapshot ?? { ts: new Date().toISOString() });
  } catch (err) {
    console.error("[engineering] snapshot error:", err);
    res.status(500).json({ error: "Failed to load engineering snapshot" });
  }
});

// GET /api/engineering/metrics
router.get("/metrics", async (req, res) => {
  const { system, metric, part = "", since = "24h", limit = 500 } = req.query || {};
  if (!system || !metric) return res.status(400).json({ error: "system and metric are required" });

  const ivl = normalizeInterval(since);
  const lim = Math.min(Number(limit) || 500, 5000);

  try {
    const { rows } = await query(
      `
      SELECT id, ts, system, metric, part, value_num, value_text, unit, status
      FROM engineering_metric
      WHERE system = $1
        AND metric = $2
        AND COALESCE(part,'') = $3
        AND ts >= NOW() - $4::interval
      ORDER BY ts DESC
      LIMIT $5
      `,
      [system, metric, part, ivl, lim]
    );
    res.json(rows);
  } catch (err) {
    console.error("[engineering] metrics error:", err);
    res.status(500).json({ error: "Failed to load metrics" });
  }
});

// GET /api/engineering/events
router.get("/events", async (req, res) => {
  const { system, severity, limit = 100 } = req.query || {};
  const params = [];
  const conds = [];

  if (system)   { params.push(system);   conds.push(`system = $${params.length}`); }
  if (severity) { params.push(severity); conds.push(`severity = $${params.length}`); }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const lim = Math.min(Number(limit) || 100, 1000);

  try {
    const { rows } = await query(
      `
      SELECT id, ts, system, severity, message, context
      FROM engineering_event
      ${where}
      ORDER BY ts DESC
      LIMIT $${params.length + 1}
      `,
      [...params, lim]
    );
    res.json(rows);
  } catch (err) {
    console.error("[engineering] events error:", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

export default router;
