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
      WITH crew_with_treatment AS (
        SELECT
          c.id         AS "crewId",
          c.name,
          c.role,
          c.on_duty    AS "raw_onDuty",
          c.busy       AS "raw_busy",
          c.deck_zone  AS "raw_zone",
          c.updated_at AS "ts",
          EXISTS (
            SELECT 1 FROM triage_visit tv
            WHERE tv.crew_id = c.id
              AND tv.ended_at IS NULL
              AND tv.state IN ('admitted','under_treatment')
          ) AS "inTreatment"
        FROM crew c
        WHERE c.active = TRUE
      )
      SELECT
        "crewId",
        name,
        role,
        "inTreatment",
        -- effective flags/zone:
        (NOT "inTreatment" AND "raw_onDuty")                        AS "onDuty",
        (NOT "inTreatment" AND "raw_onDuty" AND "raw_busy")         AS "busy",
        (CASE WHEN "inTreatment" THEN 'Sickbay' ELSE "raw_zone" END) AS "deck_zone",
        "ts"
      FROM crew_with_treatment
      ORDER BY name;
    `);

    const mapped = rows.map(r => ({
      crewId: r.crewId,
      name: r.name,
      role: r.role,
      inTreatment: r.inTreatment,
      onDuty: r.onDuty,
      busy: r.busy,
      deck_zone: r.deck_zone,
      ts: r.ts instanceof Date ? r.ts.toISOString() : r.ts,
    }));

    res.json(mapped);
  } catch (e) { next(e); }
});

// GET api/crew/:crewId/overview
router.get('/crew/:crewId/overview', async (req, res, next) => {
  const crewId = Number(req.params.crewId);
  if (!Number.isInteger(crewId) || crewId <= 0) {
    return res.status(400).json({ error: 'Invalid crewId' });
  }

  try {
    // Identity + effective presence + active visit
    const { rows } = await query(
      `
      SELECT
        c.id           AS "crewId",
        c.name,
        c.role,
        /* effective presence (patients are never on duty or busy) */
        (av."visitId" IS NOT NULL)                                     AS "inTreatment",
        (NOT (av."visitId" IS NOT NULL) AND c.on_duty)                 AS "onDuty",
        (NOT (av."visitId" IS NOT NULL) AND c.on_duty AND c.busy)      AS "busy",
        CASE WHEN (av."visitId" IS NOT NULL) THEN 'Sickbay' ELSE c.deck_zone END AS "deck_zone",
        c.updated_at   AS "ts",
        /* active visit (nullable) */
        av."visitId",
        av.state, av.acuity, av.complaint, av.bed, av.assigned_to, av.started_at
      FROM crew c
      LEFT JOIN LATERAL (
        SELECT v.id AS "visitId", v.state, v.acuity, v.complaint, v.bed, v.assigned_to, v.started_at
        FROM triage_visit v
        WHERE v.crew_id = c.id
          AND v.ended_at IS NULL
        ORDER BY v.started_at DESC
        LIMIT 1
      ) av ON TRUE
      WHERE c.id = $1 AND c.active = TRUE
      `,
      [crewId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Crew member not found or inactive' });
    }

    const base = rows[0];

    // Latest vitals per metric
    const vitalsQ = await query(
      `
      SELECT DISTINCT ON (metric_name)
             metric_name, value, text_value, unit, ts
      FROM crew_metric
      WHERE crew_id = $1 AND metric_name IN ('heart_rate','o2_sat','body_temp','bp')
      ORDER BY metric_name, ts DESC
      `,
      [crewId]
    );

    const vitalsNow = {};
    for (const r of vitalsQ.rows) {
      const val = r.value ?? r.text_value ?? null;
      if (r.metric_name === 'bp') vitalsNow.bp = val;
      if (r.metric_name === 'heart_rate') vitalsNow.heart_rate = val != null ? Number(val) : null;
      if (r.metric_name === 'o2_sat') vitalsNow.o2_sat = val != null ? Number(val) : null;
      if (r.metric_name === 'body_temp') vitalsNow.body_temp = val != null ? Number(val) : null;
    }

    // Optional: active orders + timeline (ignore if tables not present)
    let ordersActive = [];
    if (base.visitId) {
      try {
        const { rows: o } = await query(
          `SELECT id, kind, label, status, created_at, updated_at
           FROM triage_order
           WHERE visit_id = $1 AND status IN ('active','running')
           ORDER BY created_at`,
          [base.visitId]
        );
        ordersActive = o.map(r => ({
          id: r.id, kind: r.kind, label: r.label, status: r.status,
          created_at: r.created_at?.toISOString?.() ?? r.created_at ?? null,
          updated_at: r.updated_at?.toISOString?.() ?? r.updated_at ?? null,
        }));
      } catch {}
    }

    let timeline = undefined;
    if (base.visitId) {
      try {
        const { rows: ev } = await query(
          `SELECT state, at FROM triage_visit_event WHERE visit_id = $1 ORDER BY at`,
          [base.visitId]
        );
        timeline = ev.map(r => ({ state: r.state, at: r.at?.toISOString?.() ?? r.at ?? null }));
      } catch {}
    }

    // Final payload (no rank/avatar)
    const payload = {
      identity: {
        crewId: base.crewId,
        name: base.name,
        role: base.role,
      },
      presence: {
        onDuty: base.onDuty,
        busy: base.busy,
        inTreatment: base.inTreatment,
        deck_zone: base.deck_zone,
        ts: base.ts instanceof Date ? base.ts.toISOString() : base.ts,
      },
      vitalsNow: {
        heart_rate: vitalsNow.heart_rate ?? null,
        o2_sat: vitalsNow.o2_sat ?? null,
        body_temp: vitalsNow.body_temp ?? null,
        bp: vitalsNow.bp ?? null,
      },
      triageActive: base.visitId
        ? {
            visitId: base.visitId,
            state: base.state,
            acuity: base.acuity,
            complaint: base.complaint,
            bed: base.bed,
            assigned_to: base.assigned_to,
            started_at: base.started_at?.toISOString?.() ?? base.started_at ?? null,
            ...(timeline ? { timeline } : {}),
          }
        : null,
      ordersActive,
    };

    res.json(payload);
  } catch (e) {
    next(e);
  }
});

// GET api/crew/:crewId/series
router.get('/crew/:crewId/series', async (req, res, next) => {
  const crewId = Number(req.params.crewId);
  if (!Number.isInteger(crewId) || crewId <= 0) {
    return res.status(400).json({ error: 'Invalid crewId' });
  }

  try {
    // --- Parse & validate inputs ---
    const DEFAULT_METRICS = ['heart_rate', 'o2_sat', 'body_temp'];
    const metrics = String(req.query.metrics || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const wanted = (metrics.length ? metrics : DEFAULT_METRICS)
      .filter(m => ['heart_rate','o2_sat','body_temp','bp'].includes(m));

    if (wanted.length === 0) {
      return res.status(400).json({ error: 'No valid metrics requested' });
    }

    const parseDur = (s, {minSec=5, maxSec=24*3600} = {}) => {
      if (!s) return { sec: 2*3600, pg: '2 hours' }; // default 2h
      const m = String(s).match(/^(\d+)\s*([smhd])$/i);
      if (!m) return { sec: 2*3600, pg: '2 hours' };
      const n = Number(m[1]);
      const u = m[2].toLowerCase();
      const mult = u === 's' ? 1 : u === 'm' ? 60 : u === 'h' ? 3600 : 86400;
      let sec = Math.max(minSec, Math.min(maxSec, n * mult));
      // build postgres interval string
      const unitWord = u === 's' ? 'seconds' : u === 'm' ? 'minutes' : u === 'h' ? 'hours' : 'days';
      const pg = `${Math.round(sec / (u==='s'?1:u==='m'?60:u==='h'?3600:86400))} ${unitWord}`;
      return { sec, pg };
    };

    const { sec: windowSec, pg: windowPg } = parseDur(req.query.window, {minSec:5, maxSec:24*3600});
    const { sec: bucketSec } = parseDur(req.query.bucket, {minSec:5, maxSec:windowSec});

    // Guard: bucket cannot exceed window
    const effBucketSec = Math.min(bucketSec, windowSec);

    // Separate numeric metrics (aggregated) and non-numeric (we’ll just return latest)
    const numericWanted = wanted.filter(m => m !== 'bp');
    const includeBP = wanted.includes('bp');

    const out = {};
    for (const m of wanted) out[m] = [];

    // --- Numeric metrics: bucket + average within bucket ---
    if (numericWanted.length) {
      const { rows } = await query(
        `
        WITH raw AS (
          SELECT
            metric_name,
            to_timestamp(floor(extract(epoch from ts) / $3)::bigint * $3) AS tslot,
            value::double precision AS v
          FROM crew_metric
          WHERE crew_id = $1
            AND metric_name = ANY ($2)
            AND ts >= NOW() - $4::interval
            AND value IS NOT NULL
        )
        SELECT metric_name, tslot AS t, AVG(v) AS v
        FROM raw
        GROUP BY metric_name, tslot
        ORDER BY metric_name, t;
        `,
        [crewId, numericWanted, effBucketSec, windowPg]
      );

      for (const r of rows) {
        out[r.metric_name].push({
          t: r.t instanceof Date ? r.t.toISOString() : r.t,
          v: r.v == null ? null : Number(r.v),
        });
      }
    }

    // --- BP (string) → return latest point within window (no bucketing) ---
    if (includeBP) {
      const { rows: bpRows } = await query(
        `
        SELECT text_value, ts
        FROM crew_metric
        WHERE crew_id = $1
          AND metric_name = 'bp'
          AND ts >= NOW() - $2::interval
          AND (text_value IS NOT NULL OR value IS NOT NULL)
        ORDER BY ts DESC
        LIMIT 1;
        `,
        [crewId, windowPg]
      );
      if (bpRows[0]) {
        out.bp.push({
          t: bpRows[0].ts instanceof Date ? bpRows[0].ts.toISOString() : bpRows[0].ts,
          v: bpRows[0].text_value ?? String(bpRows[0].value),
        });
      }
    }

    res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
