// backend/src/simulator.js
import { getClient } from '../../../database/db.js';

// What metrics to simulate
const METRICS = [
  { name: "heart_rate", unit: "bpm", base: 72, variance: 15, clamp: [40, 160] },
  { name: "o2_sat",     unit: "%",   base: 98, variance: 2,  clamp: [80, 100] },
  { name: "body_temp",  unit: "°C",  base: 36.8, variance: 0.7, clamp: [34, 41] },
];

function jitter(base, variance, [min, max]) {
  const v = base + (Math.random() * 2 - 1) * variance;
  return Math.max(min, Math.min(max, Number(v.toFixed(1))));
}

/**
 * Starts the simulator loop
 * @param {object} deps
 * @param {(payload) => void} deps.emitTelemetry
 * @param {number} intervalMs
 */
export async function startSimulator({ emitTelemetry, intervalMs = 1000 }) {
  const c = await getClient();
  try {
    // get crew list once
    const crewRows = (await c.query("SELECT id FROM crew WHERE active = true")).rows;
    if (crewRows.length === 0) {
      console.warn("[sim] No active crew; nothing to simulate");
      return () => {};
    }

    let stopped = false;

    async function tick() {
      if (stopped) return;
      const now = new Date();

      for (const crew of crewRows) {
        for (const m of METRICS) {
          const value = jitter(m.base, m.variance, m.clamp);

          // 1) persist to DB
          await c.query(
            `INSERT INTO crew_metric (ts, crew_id, metric_name, value, unit)
             VALUES ($1, $2, $3, $4, $5)`,
            [now, crew.id, m.name, value, m.unit]
          );

          // 2) broadcast live
          emitTelemetry({
            crewId: crew.id,
            metric: m.name,
            value,
            unit: m.unit,
            ts: now,
          });
        }
      }
      setTimeout(tick, intervalMs);
    }

    setTimeout(tick, intervalMs);

    // return stopper
    return () => {
      stopped = true;
      try { c.release(); } catch {}
    };
  } catch (err) {
    c.release?.();
    console.error("[sim] error:", err);
    return () => {};
  }
}
