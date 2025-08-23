import { Router } from 'express';
import { query } from '../../database/db.js';

const router = Router();

// GET /api/crew/latest?metrics=a,b
router.get('/crew/latest', async (req, res) => {
  const metrics = req.query.metrics
    ? req.query.metrics.split(',').map(s => s.trim()).filter(Boolean)
    : null;

  try {
    const sql = `
      WITH ranked AS (
        SELECT cm.*,
               ROW_NUMBER() OVER (PARTITION BY crew_id, metric_name ORDER BY ts DESC, id DESC) rn
        FROM crew_metric cm
        ${metrics ? 'WHERE metric_name = ANY($1)' : ''}
      )
      SELECT crew_id, metric_name AS metric, value, text_value, unit, ts
      FROM ranked
      WHERE rn = 1
      ORDER BY crew_id, metric;
    `;
    const rows = (await query(sql, metrics ? [metrics] : [])).rows;
    res.json({ ts: new Date().toISOString(), data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/crew/events?limit=100&since=ISO&crewIds=1,2
router.get('/crew/events', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '100', 10), 1000);
  const since = req.query.since || null;
  const crewIds = req.query.crewIds?.toLowerCase() === 'all'
    ? null
    : (req.query.crewIds?.split(',').map(n => parseInt(n, 10)).filter(Number.isFinite) || null);

  let where = '1=1'; const params = [];
  if (since)   { params.push(since);   where += ` AND ts >= $${params.length}`; }
  if (crewIds) { params.push(crewIds); where += ` AND crew_id = ANY($${params.length}::int[])`; }

  try {
    const sql = `
      SELECT id, ts, crew_id, event_type, severity, details
      FROM crew_event
      WHERE ${where}
      ORDER BY ts DESC
      LIMIT ${limit};
    `;
    const rows = (await query(sql, params)).rows;
    res.json({ data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET api/crew/stats
router.get('/crew/stats', async (req, res) => {
  const metrics = req.query.metrics
    ? req.query.metrics.split(',').map(s => s.trim()).filter(Boolean)
    : null;

  try {
    const sql = `
      WITH ranked AS (
        SELECT
          cm.crew_id,
          cm.metric_name,
          cm.value,
          cm.text_value,
          cm.unit,
          cm.ts,
          ROW_NUMBER() OVER (
            PARTITION BY cm.crew_id, cm.metric_name
            ORDER BY cm.ts DESC, cm.id DESC
          ) AS rn
        FROM crew_metric cm
        ${metrics ? 'WHERE cm.metric_name = ANY($1)' : ''}
      )
      SELECT
        c.id                AS "crewId",
        c.name              AS "name",
        MAX(CASE WHEN r.metric_name = 'heart_rate' THEN r.value END)     AS heart_rate,
        MAX(CASE WHEN r.metric_name = 'o2_sat'     THEN r.value END)     AS o2_sat,
        MAX(CASE WHEN r.metric_name = 'body_temp'  THEN r.value END)     AS body_temp,
        MAX(r.ts)           AS ts
      FROM crew c
      LEFT JOIN ranked r
        ON r.crew_id = c.id AND r.rn = 1
      WHERE c.active = TRUE
      GROUP BY c.id, c.name
      ORDER BY c.id;
    `;
    const params = metrics ? [metrics] : [];
    const rows = (await query(sql, params)).rows;
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }});

// GET api/crew/presence
router.get('/crew/presence', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        id              AS "crewId",
        name,
        role,
        deck_zone       AS "deck_zone",
        on_duty         AS "onDuty",
        busy            AS "busy",
        updated_at      AS "ts"
      FROM crew
      WHERE active = TRUE
      ORDER BY name;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
