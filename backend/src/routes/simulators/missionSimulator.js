import { query } from '../../../database/db.js';

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export async function startMissionSimulator({
  io = null,
  intervalMs = Number(process.env.MISSION_SIM_INTERVAL_MS) || 5000,
  advanceChance = Number(process.env.MISSION_SIM_ADVANCE_CHANCE) || 0.6,
  blockChance = Number(process.env.MISSION_SIM_BLOCK_CHANCE) || 0.12,
  unblockChance = Number(process.env.MISSION_SIM_UNBLOCK_CHANCE) || 0.18,
  completeOnAllDone = ['1','true','yes'].includes(String(process.env.MISSION_SIM_COMPLETE_ON_ALL_DONE || 'true').toLowerCase()),
} = {}) {

  let timer = null;

  async function getCurrentMission() {
    const { rows } = await query(
      `SELECT id, status FROM mission
        ORDER BY
          (status = 'in_progress') DESC,
          (status = 'hold') DESC,
          (status = 'planned') DESC,
          COALESCE(started_at, updated_at) DESC,
          id DESC
        LIMIT 1`
    );
    return rows[0] ?? null;
  }

  async function tick() {
    const mission = await getCurrentMission();
    if (!mission) return;

    // If nothing in progress, try to resume planned → in_progress
    if (mission.status !== 'in_progress') {
      // resume if we have any planned mission
      await query(
        `UPDATE mission SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
          WHERE id = $1 AND status <> 'in_progress'`,
        [mission.id]
      );
      await query(
        `INSERT INTO mission_event (mission_id, kind, payload)
         VALUES ($1, 'resume', '{"sim":true}'::jsonb)`,
        [mission.id]
      );
      return;
    }

    // Load objectives
    const { rows: objs } = await query(
      `SELECT id, state, priority
         FROM mission_objective
        WHERE mission_id = $1
        ORDER BY priority DESC, id ASC`,
      [mission.id]
    );
    if (objs.length === 0) return;

    // Decide an action
    const candidates = objs.filter(o => o.state !== 'done');
    if (candidates.length === 0) {
      if (completeOnAllDone) {
        await query('BEGIN');
        try {
          await query(
            `UPDATE mission SET status = 'completed', ended_at = COALESCE(ended_at, NOW()), updated_at = NOW()
             WHERE id = $1 AND status <> 'completed'`,
            [mission.id]
          );
          await query(
            `INSERT INTO mission_event (mission_id, kind, payload)
             VALUES ($1, 'completed', '{"sim":"auto"}'::jsonb)`,
            [mission.id]
          );
          await query('COMMIT');
        } catch (e) { await query('ROLLBACK'); }
      }
      return;
    }

    const target = pick(candidates);

    // Maybe unblock if blocked
    if (target.state === 'blocked' && Math.random() < unblockChance) {
      await transitionObjective(mission.id, target.id, 'in_progress', { reason: 'unblock' });
      return;
    }

    // Maybe block
    if (target.state !== 'blocked' && Math.random() < blockChance) {
      await transitionObjective(mission.id, target.id, 'blocked', { reason: 'obstacle' });
      return;
    }

    // Advance flow
    if (Math.random() < advanceChance) {
      const next = nextState(target.state);
      if (next) {
        await transitionObjective(mission.id, target.id, next, { reason: 'advance' });
      }
    } else {
      // Otherwise, emit a heartbeat note sometimes
      if (Math.random() < 0.2) {
        await query(
          `INSERT INTO mission_event (mission_id, kind, payload)
           VALUES ($1, 'note', '{"msg":"sim tick"}'::jsonb)`,
          [mission.id]
        );
      }
    }
  }

  function nextState(state) {
    if (state === 'not_started') return 'in_progress';
    if (state === 'in_progress') return 'done';
    return null; // blocked stays until unblocked
  }

  async function transitionObjective(missionId, objId, toState, extraPayload) {
    await query('BEGIN');
    try {
      const cur = await query(
        `SELECT state FROM mission_objective WHERE id = $1 AND mission_id = $2 FOR UPDATE`,
        [objId, missionId]
      );
      const prev = cur.rows[0]?.state;
      if (!prev || prev === toState) { await query('ROLLBACK'); return; }

      await query(
        `UPDATE mission_objective SET state = $1, updated_at = NOW() WHERE id = $2`,
        [toState, objId]
      );
      await query(
        `UPDATE mission SET updated_at = NOW() WHERE id = $1`,
        [missionId]
      );
      await query(
        `INSERT INTO mission_event (mission_id, kind, payload)
         VALUES ($1, 'objective_state', $2::jsonb)`,
        [missionId, JSON.stringify({ objective_id: Number(objId), from: prev, to: toState, ...extraPayload })]
      );

      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK');
      console.error('[missionSim] transition error', e);
    }
  }

  timer = setInterval(tick, intervalMs);
  console.log(`[missionSim] running every ${intervalMs}ms`);
  return async () => { clearInterval(timer); };
}
