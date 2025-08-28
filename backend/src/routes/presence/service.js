import { query } from '../../../database/db.js';

// Counts respect triage: admitted/under_treatment = OFF-duty (not counted in on-duty)
// "busy" here counts only busy ON-DUTY crew (so % makes sense)
export async function computeEffectiveSummary() {
  const { rows: [r] } = await query(`
    WITH tri AS (
      SELECT DISTINCT crew_id
      FROM triage_visit
      WHERE ended_at IS NULL
        AND state IN ('admitted','under_treatment')
    )
    SELECT
      COUNT(*) FILTER (WHERE c.active)                                   AS total,
      COUNT(*) FILTER (WHERE c.active AND c.on_duty AND t.crew_id IS NULL) AS on_duty,
      COUNT(*) FILTER (WHERE c.active AND c.on_duty AND t.crew_id IS NULL AND c.busy) AS busy_on_duty
    FROM crew c
    LEFT JOIN tri t ON t.crew_id = c.id;
  `);

  const total   = Number(r?.total ?? 0);
  const onDuty  = Number(r?.on_duty ?? 0);
  const busy    = Number(r?.busy_on_duty ?? 0);
  const busyPct = onDuty ? Math.round((busy / onDuty) * 100) : 0;

  return { total, onDuty, busy, busyPct, ts: new Date() };
}

export async function fetchNewMission(missionId) {
  const { rows } = await query(`
      SELECT id, code, sector, authority, status, progress_pct,
             stardate, started_at, ended_at, updated_at
      FROM mission
      WHERE id = $1
    `, [missionId]);
    const mission = rows[0];
    if (!mission) return;

    return mission;
}