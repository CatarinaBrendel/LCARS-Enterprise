// backend/src/presenceSimulator.js
import { getClient, query } from '../database/db.js';

const TICK_MS_MIN = 2000;
const TICK_MS_MAX = 4000;
const SUMMARY_MS = 5000;

function jitter(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function startPresenceSimulator({ emitPresenceUpdate, emitPresenceSummary }) {
  let stopped = false;

  async function tick() {
    if (stopped) return;
    const { rows: crew } = await query(
      `SELECT id, on_duty, busy, COALESCE(deck_zone,'Bridge') AS deck_zone
         FROM crew WHERE active = TRUE`
    );

    if (crew.length) {
      const sampleSize = Math.max(1, Math.floor(crew.length * 0.25));
      const sample = [...crew].sort(() => Math.random() - 0.5).slice(0, sampleSize);

      const client = await getClient();
      try {
        await client.query('BEGIN');
        for (const r of sample) {
          let onDuty = r.on_duty;
          let busy = r.busy;
          let zone = r.deck_zone;
          let changed = false;

          if (onDuty) {
            if (Math.random() < 0.03) { onDuty = false; busy = false; changed = true; }
            else {
              if (Math.random() < 0.12) { busy = !busy; changed = true; }
              if (Math.random() < 0.10) {
                const zones = ['Bridge','Sickbay','Engineering','Cargo','Science Lab','Quarters','Shuttlebay','Astrometrics','Galley'];
                let nz = zones[Math.floor(Math.random() * zones.length)];
                if (nz === zone) nz = zones[(zones.indexOf(nz)+1) % zones.length];
                zone = nz; changed = true;
              }
            }
          } else {
            if (Math.random() < 0.06) { onDuty = true; changed = true; }
          }

          if (changed) {
            const { rows: [u] } = await client.query(
              `UPDATE crew SET on_duty=$2, busy=$3, deck_zone=$4, updated_at=NOW()
                 WHERE id=$1 RETURNING id, on_duty, busy, deck_zone, updated_at`,
              [r.id, onDuty, busy, zone]
            );
            emitPresenceUpdate({
              crewId: u.id,
              onDuty: u.on_duty,
              busy: u.busy,
              deck_zone: u.deck_zone,
              ts: u.updated_at,
            });
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('[presence] tick error:', e?.message || e);
      } finally {
        client.release();
      }
    }

    setTimeout(tick, jitter(TICK_MS_MIN, TICK_MS_MAX));
  }

  const summaryTimer = setInterval(async () => {
    if (stopped) return;
    const { rows: [s] = [{}] } = await query(
      `SELECT COUNT(*)::int AS total,
              SUM((on_duty)::int)::int AS onDuty,
              SUM((on_duty AND busy)::int)::int AS busy
         FROM crew WHERE active = TRUE`
    );
    const busyPct = s?.total ? Math.round((s.busy / s.total) * 100) : 0;
    emitPresenceSummary({ total: s?.total || 0, onDuty: s?.onDuty || 0, busy: s?.busy || 0, busyPct, ts: new Date().toISOString() });
  }, SUMMARY_MS);

  const { rows: treatedIds } = await query(`
    SELECT DISTINCT crew_id FROM triage_visit
    WHERE ended_at IS NULL AND state IN ('admitted','under_treatment')
  `);
  const treatedSet = new Set(treatedIds.map(r => r.crew_id));

  const sample = crew.filter(r => !treatedSet.has(r.id)); // don't toggle those in treatment

  // kick off
  setTimeout(tick, jitter(TICK_MS_MIN, TICK_MS_MAX));

  // return a stopper
  return () => { stopped = true; clearInterval(summaryTimer); };
}
