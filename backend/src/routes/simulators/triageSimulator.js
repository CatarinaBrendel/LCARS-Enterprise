// backend/src/simulators/triageSimulator.js
import { query } from '../../../database/db.js';

/**
 * Condition ladder encoded via acuity:
 *  5: critical, 4: serious, 3: stable, 2: fair, 1: good
 */
const acuityToCondition = { 5: 'critical', 4: 'serious', 3: 'stable', 2: 'fair', 1: 'good' };
const conditionToAcuity = { critical: 5, serious: 4, stable: 3, fair: 2, good: 1 };

/**
 * Tuning knobs (SIM time, not wall time):
 * We run on "ticks". Convert hours → ticks with HOURS * TICKS_PER_HOUR.
 * For dev speed, 1 sim hour can be a few ticks.
 */
const DEFAULTS = {
  intervalMs: 10_000,     // tick every 10s (real time)
  admitChance: 0.25,      // chance to admit when a candidate exists
  maxConcurrent: 3,       // cap simultaneous active treatments
  TICKS_PER_HOUR: 3,      // 3 ticks = 1 sim hour → 24h = 72 ticks
  // Minimum dwell per *step* before degrading to the next better condition.
  stepHours: {
    critical: 6,          // >= 6h before critical → serious
    serious: 6,           // >= 6h before serious → stable
    stable:  2,           // >= 2h before stable → fair
    fair:    1,           // >= 1h before fair → good
  },
  // Minimum total stay based on initial condition at admit.
  // Critical/Serious must stay ≥ 24h before discharge.
  minTotalHoursByInitial: {
    critical: 24,
    serious:  24,
    stable:   6,
    fair:     2,
    good:     0,
  },
  // Observation after reaching GOOD before discharge.
  observationHoursAtGood: 1,
};

export function startTriageSimulator(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const {
    intervalMs, admitChance, maxConcurrent, TICKS_PER_HOUR,
    stepHours, minTotalHoursByInitial, observationHoursAtGood,
    logger = console,
  } = cfg;

  // Per-visit simulation plan (in-memory). Keyed by visitId.
  // We only track visits spawned by the simulator (complaint: 'simulated incident').
  const plans = new Map();

  const hoursToTicks = (h) => Math.max(1, Math.round(h * TICKS_PER_HOUR));

  async function admitOneIfRoom() {
    // How many are currently active (under_treatment or recovering)?
    const { rows: [{ n_active }] } = await query(`
      SELECT COUNT(*)::int AS n_active
      FROM triage_visit
      WHERE ended_at IS NULL
        AND state IN ('admitted','under_treatment','recovering')
    `);

    if (n_active >= maxConcurrent) return;

    // Pick a candidate (on duty, active, not already in treatment).
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
    if (!cands.length || Math.random() >= admitChance) return;

    const crewId = cands[0].crew_id;
    // Draw an initial condition (bias toward the mid-range if you prefer)
    const initialAcuity = (1 + Math.floor(Math.random() * 5)); // 1..5
    const initialCond = acuityToCondition[initialAcuity];

    // Admit
    const { rows: [{ id: visitId }] } = await query(`
      INSERT INTO triage_visit (crew_id, state, acuity, complaint, bed)
      VALUES ($1, 'under_treatment', $2,
              'simulated incident',
              ('Bed ' || (1 + floor(random()*6))))
      RETURNING id
    `, [crewId, initialAcuity]);

    // Optional: log events if your event table exists
    try {
      await query(
        `INSERT INTO triage_visit_event (visit_id, kind, payload)
         VALUES ($1, 'admitted', jsonb_build_object('acuity', $2, 'condition', $3))`,
        [visitId, initialAcuity, initialCond]
      );
    } catch { /* no-op if table missing */ }

    // Seed the plan
    plans.set(visitId, {
      visitId,
      crewId,
      initialCond,
      totalTicksLeft: hoursToTicks(minTotalHoursByInitial[initialCond]),
      stage: initialCond,                             // current condition
      stageTicksLeft: hoursToTicks(stepHours[initialCond] ?? 1),
      atGoodTicks: null,                              // starts counting once we hit 'good'
    });

    logger.log(`[triage-sim] admitted crew ${crewId} as ${initialCond} (visit ${visitId})`);
  }

  async function progressOne(visitId, plan) {
    // Fetch current row (fresh each tick to respect any manual changes)
    const { rows } = await query(`
      SELECT id, crew_id, state, acuity, started_at, ended_at
      FROM triage_visit
      WHERE id = $1
      LIMIT 1
    `, [visitId]);
    const v = rows[0];
    if (!v || v.ended_at) {
      plans.delete(visitId);
      return;
    }

    // If someone manually discharged, stop tracking.
    if (v.state === 'discharged') {
      plans.delete(visitId);
      return;
    }

    // Normalize our stage to DB acuity if needed
    const dbCond = acuityToCondition[v.acuity] || plan.stage;
    if (dbCond !== plan.stage) {
      plan.stage = dbCond;
      plan.stageTicksLeft = hoursToTicks(stepHours[dbCond] ?? 1);
      if (dbCond === 'good') plan.atGoodTicks = plan.atGoodTicks ?? 0;
    }

    // Decrement total/minimum counters
    if (plan.totalTicksLeft > 0) plan.totalTicksLeft -= 1;

    // If not at GOOD yet, consume stage ticks and degrade when it hits 0
    if (plan.stage !== 'good') {
      plan.stageTicksLeft -= 1;
      if (plan.stageTicksLeft <= 0) {
        // Move to the next better condition by decreasing acuity by 1
        const nextAcuity = Math.max(1, v.acuity - 1);
        const nextCond = acuityToCondition[nextAcuity];

        // Update DB only if acuity hasn't changed since we read it (idempotent)
        const { rowCount } = await query(`
          UPDATE triage_visit
             SET acuity = $2
           WHERE id = $1
             AND ended_at IS NULL
             AND acuity = $3
        `, [visitId, nextAcuity, v.acuity]);

        if (rowCount) {
          try {
            await query(
              `INSERT INTO triage_visit_event (visit_id, kind, payload)
               VALUES ($1, 'acuity_change', jsonb_build_object('from', $2, 'to', $3))`,
              [visitId, acuityToCondition[v.acuity], nextCond]
            );
          } catch { /* ignore if events table missing */ }
          plan.stage = nextCond;
          plan.stageTicksLeft = hoursToTicks(stepHours[nextCond] ?? 1);
          if (nextCond === 'good') plan.atGoodTicks = 0;
          // Keep state 'under_treatment' until we reach 'good'
        }
      }
      return; // not yet good — cannot discharge
    }

    // We are at GOOD
    plan.atGoodTicks = (plan.atGoodTicks ?? 0) + 1;

    // Move to RECOVERING once we hit GOOD (first time)
    if (v.state !== 'recovering') {
      const { rowCount } = await query(`
        UPDATE triage_visit
           SET state = 'recovering'
         WHERE id = $1
           AND ended_at IS NULL
           AND state <> 'recovering'
      `, [visitId]);
      if (rowCount) {
        try {
          await query(`INSERT INTO triage_visit_event (visit_id, kind) VALUES ($1, 'recovering')`, [visitId]);
        } catch {}
      }
    }

    // Enforce both: total min stay (by initial) AND observation-at-good
    const needMoreTotal = plan.totalTicksLeft > 0;
    const needMoreObs   = plan.atGoodTicks < hoursToTicks(observationHoursAtGood);

    if (needMoreTotal || needMoreObs) {
      return; // Not eligible for discharge yet
    }

    // Eligible → discharge
    const { rowCount } = await query(`
      UPDATE triage_visit
         SET state='discharged', ended_at=now()
       WHERE id = $1
         AND ended_at IS NULL
         AND acuity = $2     -- only if still GOOD
    `, [visitId, conditionToAcuity.good]);

    if (rowCount) {
      try {
        await query(`INSERT INTO triage_visit_event (visit_id, kind) VALUES ($1, 'discharged')`, [visitId]);
      } catch {}
      plans.delete(visitId);
      // presence WS triggers will fire via DB
    }
  }

  async function seedPlansForActiveSimPatients() {
    // Ensure we track any simulator-created active visits if the process restarted
    const { rows } = await query(`
      SELECT id, crew_id, acuity
      FROM triage_visit
      WHERE ended_at IS NULL
        AND complaint = 'simulated incident'
    `);
    for (const r of rows) {
      if (plans.has(r.id)) continue;
      const cond = acuityToCondition[r.acuity] || 'stable';
      plans.set(r.id, {
        visitId: r.id,
        crewId: r.crew_id,
        initialCond: cond, // best effort (true initial might have been worse)
        totalTicksLeft: hoursToTicks(minTotalHoursByInitial[cond]),
        stage: cond,
        stageTicksLeft: hoursToTicks(stepHours[cond] ?? 1),
        atGoodTicks: (cond === 'good' ? 0 : null),
      });
    }
  }

  async function tick() {
    try {
      // 1) Ensure we have plans for any active simulator visits
      await seedPlansForActiveSimPatients();

      // 2) Maybe admit someone new
      await admitOneIfRoom();

      // 3) Progress everyone according to the rules
      for (const [visitId, plan] of Array.from(plans.entries())) {
        await progressOne(visitId, plan);
      }
    } catch (e) {
      logger.warn('[triage-sim] tick error:', e.message);
    }
  }

  const timer = setInterval(tick, intervalMs);
  logger.log(`[triage-sim] started (interval=${intervalMs}ms, max=${maxConcurrent}, ticks/hr=${TICKS_PER_HOUR})`);

  return function stop() {
    clearInterval(timer);
    plans.clear();
    logger.log('[triage-sim] stopped');
  };
}
