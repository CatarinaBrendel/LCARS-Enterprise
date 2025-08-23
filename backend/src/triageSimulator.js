// backend/src/simulators/triageSimulator.js
import { query } from '../database/db.js';

export function startTriageSimulator({
  intervalMs = 10_000,         // tick every 10s
  admitChance = 0.2,           // 20% chance to admit when a candidate exists
  maxConcurrent = 3,           // cap simultaneous active treatments
  logger = console,
} = {}) {
  let timer = null;
  const timeouts = new Set();

  async function tick() {
    try {
      // How many are currently under active treatment?
      const { rows: [{ n_active }] } = await query(`
        SELECT COUNT(*)::int AS n_active
        FROM triage_visit
        WHERE ended_at IS NULL
          AND state IN ('admitted','under_treatment')
      `);

      // Maybe admit someone
      if (n_active < maxConcurrent) {
        const { rows: cands } = await query(`
          SELECT c.id AS crew_id
          FROM crew c
          WHERE c.active = TRUE
            AND c.on_duty = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM triage_visit tv
              WHERE tv.crew_id = c.id AND tv.ended_at IS NULL
            )
          ORDER BY random()
          LIMIT 1
        `);

        if (cands.length && Math.random() < admitChance) {
          const crewId = cands[0].crew_id;
          await query(`
            INSERT INTO triage_visit (crew_id, state, acuity, complaint, bed)
            VALUES (
              $1,
              'under_treatment',
              (1 + floor(random()*5))::int,
              'simulated incident',
              ('Bed ' || (1 + floor(random()*6)))
            )
          `, [crewId]);

          // Auto-discharge later (30–120s)
          const duration = 30_000 + Math.floor(Math.random() * 90_000);
          const t = setTimeout(async () => {
            try {
              // 50% step to recovering first, then discharge at next tick
              const { rowCount } = await query(`
                UPDATE triage_visit
                   SET state = 'recovering'
                 WHERE crew_id = $1
                   AND ended_at IS NULL
                   AND state = 'under_treatment'
              `, [crewId]);
              if (!rowCount) {
                await query(`
                  UPDATE triage_visit
                     SET state='discharged', ended_at=now()
                   WHERE crew_id=$1 AND ended_at IS NULL
                `, [crewId]);
              }
            } catch (e) {
              logger.warn('[triage-sim] discharge/progress error:', e.message);
            } finally {
              timeouts.delete(t);
            }
          }, duration);
          timeouts.add(t);
        }
      }

      // Occasionally progress recovering → discharged
      await query(`
        UPDATE triage_visit
           SET state='discharged', ended_at=now()
         WHERE ended_at IS NULL
           AND state='recovering'
           AND random() < 0.3
      `);

    } catch (e) {
      logger.warn('[triage-sim] tick error:', e.message);
    }
  }

  timer = setInterval(tick, intervalMs);
  logger.log(`[triage-sim] started (interval=${intervalMs}ms, admitChance=${admitChance}, max=${maxConcurrent})`);

  return function stop() {
    if (timer) clearInterval(timer);
    for (const t of Array.from(timeouts)) clearTimeout(t);
    timeouts.clear();
    logger.log('[triage-sim] stopped');
  };
}
