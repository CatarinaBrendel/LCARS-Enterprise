import { Router } from 'express';
import { query } from '../../../database/db.js';

const ALLOWED_METRICS = new Set([
  'heart_rate','o2_sat','stress_index','fatigue_index',
  'location_zone','steps_per_min','task_load','suit_temp','radiation_dose'
]);

const ALLOWED_EVENTS = new Set([
  'high_stress','low_oxygen','entered_restricted_zone','injury_reported','fall_detected'
]);

function auth(req, res, next) {
  const hdr = req.get('authorization') || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token || token !== (process.env.INGEST_TOKEN || 'dev_only_change_me_please')) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  next();
}

const router = Router();

router.post('/internal/telemetry/ingest', auth, async (req, res) => {
  const { metrics = [], events = [] } = req.body || {};
  if (!Array.isArray(metrics) || !Array.isArray(events)) {
    return res.status(400).json({ ok: false, error: 'metrics/events must be arrays' });
  }

  for (const m of metrics) {
    if (!m?.crew_id || !m?.metric || !m?.ts) {
      return res.status(400).json({ ok: false, error: 'metric missing crew_id/metric/ts' });
    }
    if (!ALLOWED_METRICS.has(m.metric)) {
      return res.status(400).json({ ok: false, error: `unknown metric ${m.metric}` });
    }
    const hasNum = typeof m.value === 'number';
    const hasText = typeof m.text_value === 'string';
    if (hasNum === hasText) {
      return res.status(400).json({ ok: false, error: 'metric must have exactly one of value or text_value' });
    }
  }

  for (const ev of events) {
    if (!ev?.crew_id || !ev?.event_type || !ev?.ts || typeof ev?.severity !== 'number') {
      return res.status(400).json({ ok: false, error: 'event missing crew_id/event_type/ts/severity' });
    }
    if (!ALLOWED_EVENTS.has(ev.event_type)) {
      return res.status(400).json({ ok: false, error: `unknown event ${ev.event_type}` });
    }
    if (ev.severity < 1 || ev.severity > 5) {
      return res.status(400).json({ ok: false, error: 'severity out of range' });
    }
  }

  try {
    // simple, readable inserts (fine for tests/dev)
    for (const m of metrics) {
      await query(
        `INSERT INTO crew_metric (ts, crew_id, metric_name, value, text_value, unit)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [m.ts, m.crew_id, m.metric,
         typeof m.value === 'number' ? m.value : null,
         typeof m.text_value === 'string' ? m.text_value : null,
         m.unit ?? null]
      );
    }

    for (const ev of events) {
      await query(
        `INSERT INTO crew_event (ts, crew_id, event_type, severity, details)
         VALUES ($1,$2,$3,$4,$5)`,
        [ev.ts, ev.crew_id, ev.event_type, ev.severity, ev.details ?? null]
      );
    }

    // optional: broadcast to WS listeners if attached
    const wsBus = req.app.get('wsBus');
    if (wsBus && metrics.length) wsBus.broadcastTick(metrics);
    if (wsBus && events.length)  for (const ev of events) wsBus.broadcastEvent(ev);

    res.status(202).json({ ok: true, inserted: { metrics: metrics.length, events: events.length } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
