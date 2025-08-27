import { getClient, query } from "../../../database/db.js";

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
if (!globalThis.__missionSim) globalThis.__missionSim = { running: false };

export async function startMissionSimulator({
  // prefer passing helpers from websocker.js; fall back to io if only io is provided
  io = null,
  emitMissionStatus,
  emitMissionProgress,
  emitMissionObjective,
  emitMissionEvent,
  intervalMs = Number(process.env.MISSION_SIM_INTERVAL_MS) || 5000,
  advanceChance = Number(process.env.MISSION_SIM_ADVANCE_CHANCE) || 0.6,
  blockChance = Number(process.env.MISSION_SIM_BLOCK_CHANCE) || 0.12,
  unblockChance = Number(process.env.MISSION_SIM_UNBLOCK_CHANCE) || 0.18,
  completeOnAllDone = ["1", "true", "yes"].includes(
    String(process.env.MISSION_SIM_COMPLETE_ON_ALL_DONE || "true").toLowerCase()
  ),
} = {}) {
  // --------- advisory lock so only one simulator runs -----------
  const LOCK_KEY = 424242;
  const lockClient = await getClient();
  try {
    const { rows } = await lockClient.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY]);
    if (!rows[0]?.ok) {
      console.warn("[missionSim] another instance holds the advisory lock; not starting here");
      try { lockClient.release(); } catch {}
      return async () => {};
    }
  } catch (e) {
    console.warn("[missionSim] failed to acquire advisory lock:", e?.message);
    try { lockClient.release(); } catch {}
    return async () => {};
  }

  if (globalThis.__missionSim.running) {
    console.warn("[missionSim] already running, skipping second start");
    return async () => {};
  }
  globalThis.__missionSim.running = true;

  // --------- build shims if only io was provided ----------
  if (!emitMissionStatus || !emitMissionProgress || !emitMissionObjective || !emitMissionEvent) {
    const send = (room, ev, payload) => {
      if (!io) return;
      io.emit(ev, payload);
      io.to("mission:all").emit(ev, payload);
      if (room) io.to(room).emit(ev, payload);
    };
    emitMissionStatus    = (id, status)                 => send(`mission:${id}`, "mission:status",   { missionId: id, status });
    emitMissionProgress  = (id, progress_pct)           => send(`mission:${id}`, "mission:progress", { missionId: id, progress_pct: Number(progress_pct) || 0 });
    emitMissionObjective = (id, objective_id, to, from) => io?.to?.(`mission:${id}`)?.emit("mission:objective", { missionId: id, objective_id, to, ...(from ? { from } : {}) });
    emitMissionEvent     = (id, kind, payload = {})     => {
      const ev = { missionId: id, kind, payload };
      io?.emit?.("mission:event", ev);
      io?.to?.(`mission:${id}`)?.emit("mission:event", ev);
    };
  }

  // --------- utils ----------
  async function recalcMissionProgress(missionId) {
    await query(
      `
      WITH t AS (
        SELECT
          COUNT(*)::numeric AS total,
          SUM(CASE state
                WHEN 'done' THEN 1.0
                WHEN 'in_progress' THEN 0.5
                ELSE 0.0
              END)::numeric AS score
        FROM mission_objective
        WHERE mission_id = $1
      )
      UPDATE mission m
      SET progress_pct = COALESCE(ROUND(100 * t.score / NULLIF(t.total, 0)), 0),
          updated_at = NOW()
      FROM t
      WHERE m.id = $1
      `,
      [missionId]
    );
  }

  async function getCurrentMission() {
    const { rows } = await query(
      `SELECT id, status FROM mission
        ORDER BY
          (status = 'in_progress') DESC,
          (status = 'hold')        DESC,
          (status = 'planned')     DESC,
          COALESCE(started_at, updated_at) DESC,
          id DESC
        LIMIT 1`
    );
    return rows[0] ?? null;
  }

  async function tick() {
    const mission = await getCurrentMission();
    if (!mission) return;

    // Start a planned/hold mission
    if (mission.status !== "in_progress") {
      await query(
        `UPDATE mission
           SET status = 'in_progress',
               started_at = COALESCE(started_at, NOW()),
               updated_at = NOW()
         WHERE id = $1 AND status <> 'in_progress'`,
        [mission.id]
      );
      await query(
        `INSERT INTO mission_event (mission_id, kind, payload)
         VALUES ($1, 'resume', '{"sim":true}'::jsonb)`,
        [mission.id]
      );

      await recalcMissionProgress(mission.id);
      emitMissionStatus(mission.id, "in_progress");
      const { rows: p } = await query(`SELECT progress_pct FROM mission WHERE id = $1`, [mission.id]);
      emitMissionProgress(mission.id, Number(p[0]?.progress_pct ?? 0));
      return;
    }

    // Work objectives
    const { rows: objs } = await query(
      `SELECT id, state, priority
         FROM mission_objective
        WHERE mission_id = $1
        ORDER BY priority DESC, id ASC`,
      [mission.id]
    );
    if (objs.length === 0) return;

    const candidates = objs.filter((o) => o.state !== "done");
    if (candidates.length === 0) {
      if (completeOnAllDone) {
        await query("BEGIN");
        try {
          await query(
            `UPDATE mission
                SET status = 'completed',
                    ended_at = COALESCE(ended_at, NOW()),
                    updated_at = NOW()
              WHERE id = $1 AND status <> 'completed'`,
            [mission.id]
          );
          await query(
            `INSERT INTO mission_event (mission_id, kind, payload)
             VALUES ($1, 'completed', '{"sim":"auto"}'::jsonb)`,
            [mission.id]
          );
          emitMissionEvent(mission.id, "note", { msg: "sim tick" });

          await query(`UPDATE mission SET progress_pct = 100, updated_at = NOW() WHERE id = $1`, [mission.id]);
          await query("COMMIT");

          emitMissionStatus(mission.id, "completed");
          emitMissionProgress(mission.id, 100);
          emitMissionEvent(mission.id, "completed", { sim: "auto" });
        } catch (e) {
          await query("ROLLBACK");
          console.error("[missionSim] completion error", e);
        }
      }
      return;
    }

    const target = pick(candidates);

    // Maybe unblock
    if (target.state === "blocked" && Math.random() < unblockChance) {
      await transitionObjective(mission.id, target.id, "in_progress", { reason: "unblock" });
      return;
    }

    // Maybe block
    if (target.state !== "blocked" && Math.random() < blockChance) {
      await transitionObjective(mission.id, target.id, "blocked", { reason: "obstacle" });
      return;
    }

    // Advance
    if (Math.random() < advanceChance) {
      const next = nextState(target.state);
      if (next) await transitionObjective(mission.id, target.id, next, { reason: "advance" });
    } else if (Math.random() < 0.2) {
      await query(
        `INSERT INTO mission_event (mission_id, kind, payload)
         VALUES ($1, 'note', '{"msg":"sim tick"}'::jsonb)`,
        [mission.id]
      );
      emitMissionEvent(mission.id, "note", { msg: "sim tick" });
    }
  }

  function nextState(state) {
    if (state === "not_started") return "in_progress";
    if (state === "in_progress") return "done";
    return null; // blocked stays until unblocked
  }

  async function transitionObjective(missionId, objId, toState, extraPayload) {
    await query("BEGIN");
    try {
      const cur = await query(
        `SELECT state FROM mission_objective WHERE id = $1 AND mission_id = $2 FOR UPDATE`,
        [objId, missionId]
      );
      const prev = cur.rows[0]?.state;
      if (!prev || prev === toState) { await query("ROLLBACK"); return; }

      await query(
        `UPDATE mission_objective SET state = $1, updated_at = NOW() WHERE id = $2`,
        [toState, objId]
      );
      await query(`UPDATE mission SET updated_at = NOW() WHERE id = $1`, [missionId]);
      await query(
        `INSERT INTO mission_event (mission_id, kind, payload)
         VALUES ($1, 'objective_state', $2::jsonb)`,
        [missionId, JSON.stringify({ objective_id: Number(objId), from: prev, to: toState, ...extraPayload })]
      );

      await recalcMissionProgress(missionId);
      await query("COMMIT");

      emitMissionObjective(missionId, Number(objId), toState, prev);
      const { rows: p } = await query(`SELECT progress_pct FROM mission WHERE id = $1`, [missionId]);
      emitMissionProgress(missionId, Number(p[0]?.progress_pct ?? 0));
    } catch (e) {
      await query("ROLLBACK");
      console.error("[missionSim] transition error", e);
    }
  }

  // kick + loop
  await tick();
  const timer = setInterval(tick, intervalMs);
  console.log(`[missionSim] running every ${intervalMs}ms`);

  return async () => {
    clearInterval(timer);
    globalThis.__missionSim.running = false;
    try { await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]); } catch {}
    try { lockClient.release(); } catch {}
  };
}
