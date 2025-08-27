// backend/src/routes/mission.js
import express from 'express';
import { query } from '../../database/db.js';

const router = express.Router();

/* Helpers */
async function loadMissionSnapshot(missionId) {
  const m = await query(
    `
    WITH agg AS (
      SELECT mission_id,
             ROUND(
               100 * SUM(CASE state
                           WHEN 'done' THEN 1.0
                           WHEN 'in_progress' THEN 0.5
                           ELSE 0.0
                         END) / NULLIF(COUNT(*), 0)
             )::int AS pct
      FROM mission_objective
      WHERE mission_id = $1
      GROUP BY mission_id
    )
    SELECT m.*,
           COALESCE(agg.pct, 0)::int AS progress_pct
    FROM mission m
    LEFT JOIN agg ON agg.mission_id = m.id
    WHERE m.id = $1
    `,
    [missionId]
  );
  const mission = m.rows[0] ?? null;
  if (!mission) return null;

  const [objs, teams, assigns, events] = await Promise.all([
    query(
      `SELECT id, mission_id, title, details, state, priority, updated_at
         FROM mission_objective
        WHERE mission_id = $1
        ORDER BY priority DESC, id ASC`,
      [missionId]
    ),
    query(
      `SELECT id, mission_id, name, lead_crew_id, notes
         FROM mission_team
        WHERE mission_id = $1
        ORDER BY id ASC`,
      [missionId]
    ),
    query(
      `SELECT a.id, a.team_id, a.crew_id, a.role, a.joined_at, a.left_at
         FROM mission_team_assignment a
         JOIN mission_team t ON t.id = a.team_id
        WHERE t.mission_id = $1
        ORDER BY a.team_id ASC, a.joined_at ASC, a.id ASC`,
      [missionId]
    ),
    query(
      `SELECT id, at, kind, payload::text AS payload
         FROM mission_event
        WHERE mission_id = $1
        ORDER BY at DESC, id DESC
        LIMIT 50`,
      [missionId]
    ),
  ]);

  // attach members to teams
  const membersByTeam = new Map();
  for (const a of assigns.rows) {
    if (!membersByTeam.has(a.team_id)) membersByTeam.set(a.team_id, []);
    membersByTeam.get(a.team_id).push(a);
  }
  const teamsWithMembers = teams.rows.map(t => ({
    ...t,
    members: membersByTeam.get(t.id) ?? [],
  }));

  return {
    ...mission,
    objectives: objs.rows,
    teams: teamsWithMembers,
    events: events.rows,
  };
}

function emitMission(io, event, payload, missionId) {
  if (!io) return;
  io.emit(event, payload);
  io.to('mission:all').emit(event, payload);
  if (missionId) io.to(`mission:${missionId}`).emit(event, payload);
}

// Distinct sectors for filters (optionally with counts)
router.get('/sectors', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sector, COUNT(*)::int AS count
         FROM mission
        WHERE sector IS NOT NULL AND sector <> ''
        GROUP BY sector
        ORDER BY sector ASC`
    );
    res.json({ items: rows.map(r => ({ sector: r.sector, count: r.count })) });
  } catch (err) {
    next(err);
  }
});

/* Mission List Endpoints */
// GET /api/missions (list with paging/filter/sort)
router.get('/', async (req, res, next) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const pageSize  = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? '25', 10)));
    const q         = (req.query.q ?? '').trim();
    const sector    = (req.query.sector ?? '').trim();
    const statusArg = (req.query.status ?? '').trim();
    const sortBy    = (req.query.sortBy ?? 'started_at').trim();
    const sortDir   = (req.query.sortDir ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    // UI ↔ DB status mapping
    const uiToDb = {
      'NOT STARTED': 'planned',
      'IN PROGRESS': 'in_progress',
      'HOLD': 'hold',
      'DONE': 'completed',
      'BLOCKED': 'hold',
      'ABORTED': 'aborted',
    };

    let statusList = [];
    if (statusArg) {
      statusList = statusArg
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => uiToDb[s.toUpperCase()] ?? s.toLowerCase());
      const valid = new Set(['planned','in_progress','hold','completed','aborted']);
      statusList = Array.from(new Set(statusList)).filter(s => valid.has(s));
    }

    // whitelist sorting (use f.* from filtered CTE)
    const sortColumns = new Map([
      ['code', 'f.code'],
      ['status', 'f.status'],
      ['sector', 'f.sector'],
      ['authority', 'f.authority'],
      ['progress', 'f.progress'],
      ['started_at', 'f.started_at'],
      ['updated_at', 'f.updated_at'],
    ]);
    const sortExpr = sortColumns.get(sortBy) ?? 'f.started_at';

    // dynamic WHERE
    const where = [];
    const params = [];
    let idx = 1;

    if (q) {
      where.push(`(
        m.code ILIKE $${idx} OR
        m.authority ILIKE $${idx} OR
        EXISTS (
          SELECT 1 FROM mission_objective o
           WHERE o.mission_id = m.id AND o.title ILIKE $${idx}
        )
      )`);
      params.push(`%${q}%`); idx++;
    }

    if (sector) {
      where.push(`m.sector = $${idx}`); params.push(sector); idx++;
    }

    if (statusList.length > 0) {
      where.push(`m.status = ANY($${idx})`); params.push(statusList); idx++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const sql = `
      WITH agg AS (
        SELECT mission_id,
               ROUND(
                 100 * SUM(CASE state
                             WHEN 'done' THEN 1.0
                             WHEN 'in_progress' THEN 0.5
                             ELSE 0.0
                           END) / NULLIF(COUNT(*), 0)
               )::int AS pct
        FROM mission_objective
        GROUP BY mission_id
      ),
      filtered AS (
        SELECT m.id, m.code, m.status, m.sector, m.authority, m.started_at, m.updated_at,
               COALESCE(agg.pct, 0)::int AS progress
          FROM mission m
          LEFT JOIN agg ON agg.mission_id = m.id
          ${whereSql}
      )
      SELECT f.*, COUNT(*) OVER() AS total
        FROM filtered f
        ORDER BY ${sortExpr} ${sortDir}, f.id DESC
        LIMIT $${idx} OFFSET $${idx + 1};
    `;
    params.push(pageSize, offset);

    const { rows } = await query(sql, params);
    const total = Number(rows[0]?.total ?? 0);

    const dbToUi = {
      planned: 'NOT STARTED',
      in_progress: 'IN PROGRESS',
      hold: 'HOLD',
      completed: 'DONE',
      aborted: 'ABORTED',
    };

    const items = rows.map(r => ({
      id: r.id,
      code: r.code,
      status_raw: r.status,
      status: dbToUi[r.status] ?? r.status,
      sector: r.sector,
      authority: r.authority,
      progress: Number(r.progress ?? 0),
      started_at: r.started_at,
      updated_at: r.updated_at,
    }));

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

/* Single Mission Endpoints */

// GET /api/missions/current
router.get('/current', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id
         FROM mission
        ORDER BY
          (status = 'in_progress') DESC,
          (status = 'hold') DESC,
          (status = 'planned') DESC,
          COALESCE(started_at, updated_at) DESC,
          id DESC
        LIMIT 1`
    );
    if (!rows[0]) return res.status(404).json({ error: 'no_mission' });
    const snap = await loadMissionSnapshot(rows[0].id);
    return res.json(snap);
  } catch (err) { next(err); }
});

// GET /api/missions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const snap = await loadMissionSnapshot(Number(req.params.id));
    if (!snap) return res.status(404).json({ error: 'not_found' });
    res.json(snap);
  } catch (err) { next(err); }
});

/* PATCH /api/missions/:id  { status? } */
router.patch('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { status: rawStatus } = req.body ?? {};

  // accept UI synonym "not_started" and map to DB "planned"
  const status = rawStatus === 'not_started' ? 'planned' : rawStatus;
  const ALLOWED = ['planned','in_progress','hold','completed','aborted'];
  if (!ALLOWED.includes(status)) return res.status(400).json({ error: 'bad_status' });

  const statusToEvent = {
    planned: 'note',
    in_progress: 'resume',
    hold: 'hold',
    completed: 'completed',
    aborted: 'aborted',
  };

  try {
    await query('BEGIN');

    const cur = await query(
      `
      WITH agg AS (
        SELECT mission_id,
               ROUND(100 * SUM(CASE state WHEN 'done' THEN 1.0
                                          WHEN 'in_progress' THEN 0.5
                                          ELSE 0.0 END)
                     / NULLIF(COUNT(*), 0))::int AS pct
        FROM mission_objective
        WHERE mission_id = $1
        GROUP BY mission_id
      )
      SELECT m.status,
             COALESCE(agg.pct, 0)::int AS progress_pct
      FROM mission m
      LEFT JOIN agg ON agg.mission_id = m.id
      WHERE m.id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (!cur.rows[0]) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }

    const prev = cur.rows[0].status;
    if (prev === status) {
      await query('COMMIT');
      const { io } = req.app.get('ws') || {};
      const payloadStatus = { missionId: id, status };
      const payloadProg   = { missionId: id, progress_pct: Number(cur.rows[0].progress_pct ?? 0) };
      io?.emit('mission:status', payloadStatus);
      io?.emit('mission:progress', payloadProg);
      io?.to('mission:all')?.emit('mission:status', payloadStatus);
      io?.to('mission:all')?.emit('mission:progress', payloadProg);
      io?.to(`mission:${id}`)?.emit('mission:status', payloadStatus);
      io?.to(`mission:${id}`)?.emit('mission:progress', payloadProg);
      return res.json({ ok: true, id, status, progress_pct: payloadProg.progress_pct });
    }

    const fields = ['status = $2', 'updated_at = NOW()'];
    const vals = [id, status];

    // Reset when going back to "planned" (aka UI "not_started")
    if (status === 'planned') {
      await query(
        `UPDATE mission_objective
            SET state = 'not_started', updated_at = NOW()
          WHERE mission_id = $1`,
        [id]
      );
    }
    // Optional: when marking completed, force objectives to done so progress = 100
    if (status === 'completed') {
      await query(
        `UPDATE mission_objective
            SET state = 'done', updated_at = NOW()
          WHERE mission_id = $1 AND state <> 'done'`,
        [id]
      );
    }

    await query(
      `INSERT INTO mission_event (mission_id, kind, payload)
       VALUES ($1, 'status_changed', $2::jsonb)`,
      [id, JSON.stringify({ from: prev, to: status, via: 'api' })]
    );

    if (status === 'in_progress' && prev !== 'in_progress')
      fields.push('started_at = COALESCE(started_at, NOW())');
    if ((status === 'completed' || status === 'aborted') && prev !== status)
      fields.push('ended_at = COALESCE(ended_at, NOW())');

    await query(`UPDATE mission SET ${fields.join(', ')} WHERE id = $1`, vals);

    await query(
      `INSERT INTO mission_event (mission_id, kind, payload)
       VALUES ($1, $2, $3::jsonb)`,
      [id, statusToEvent[status], JSON.stringify({ from: prev, to: status })]
    );

    const { rows: after } = await query(
      `
      WITH agg AS (
        SELECT mission_id,
               ROUND(100 * SUM(CASE state WHEN 'done' THEN 1.0
                                          WHEN 'in_progress' THEN 0.5
                                          ELSE 0.0 END)
                     / NULLIF(COUNT(*), 0))::int AS pct
        FROM mission_objective
        WHERE mission_id = $1
        GROUP BY mission_id
      )
      SELECT m.status,
             COALESCE(agg.pct, 0)::int AS progress_pct
      FROM mission m
      LEFT JOIN agg ON agg.mission_id = m.id
      WHERE m.id = $1
      `,
      [id]
    );

    await query('COMMIT');

    const { io } = req.app.get('ws') || {};
    if (io) {
      const payloadStatus = { missionId: id, status: after[0]?.status ?? status };
      const payloadProg   = { missionId: id, progress_pct: Number(after[0]?.progress_pct ?? 0) };
      io.emit('mission:status', payloadStatus);
      io.emit('mission:progress', payloadProg);
      io.to('mission:all').emit('mission:status', payloadStatus);
      io.to('mission:all').emit('mission:progress', payloadProg);
      io.to(`mission:${id}`).emit('mission:status', payloadStatus);
      io.to(`mission:${id}`).emit('mission:progress', payloadProg);
      io.to(`mission:${id}`).emit('mission:event', { missionId: id, kind: 'status_changed', payload: { from: prev, to: status, via: 'api' } });
    }

    res.json({ ok: true, id, status: after[0]?.status ?? status, progress_pct: after[0]?.progress_pct ?? 0 });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

/* PATCH /api/missions/:id/objectives/:objId  { state } */
router.patch('/:id/objectives/:objId', async (req, res, next) => {
  const missionId = Number(req.params.id);
  const objId = Number(req.params.objId);
  const { state } = req.body ?? {};
  if (!['not_started','in_progress','blocked','done'].includes(state)) {
    return res.status(400).json({ error: 'bad_state' });
  }

  try {
    await query('BEGIN');

    const cur = await query(
      `SELECT o.state
         FROM mission_objective o
        WHERE o.id = $1 AND o.mission_id = $2
        FOR UPDATE`,
      [objId, missionId]
    );
    if (!cur.rows[0]) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }
    const prev = cur.rows[0].state;
    if (prev === state) {
      await query('COMMIT');
      return res.json({ ok: true, id: objId, state });
    }

    await query(
      `UPDATE mission_objective
          SET state = $1, updated_at = NOW()
        WHERE id = $2`,
      [state, objId]
    );

    await query(
      `UPDATE mission SET updated_at = NOW() WHERE id = $1`,
      [missionId]
    );

    await query(
      `INSERT INTO mission_event (mission_id, kind, payload)
       VALUES ($1, 'objective_state', $2::jsonb)`,
      [missionId, JSON.stringify({ objective_id: objId, from: prev, to: state })]
    );

    // compute new progress to emit
    const { rows: after } = await query(
      `
      WITH agg AS (
        SELECT mission_id,
               ROUND(100 * SUM(CASE state WHEN 'done' THEN 1.0
                                          WHEN 'in_progress' THEN 0.5
                                          ELSE 0.0 END)
                     / NULLIF(COUNT(*), 0))::int AS pct
        FROM mission_objective
        WHERE mission_id = $1
        GROUP BY mission_id
      )
      SELECT COALESCE(agg.pct, 0)::int AS progress_pct
      FROM mission m
      LEFT JOIN agg ON agg.mission_id = m.id
      WHERE m.id = $1
      `,
      [missionId]
    );

    await query('COMMIT');

    // emit objective + progress so list updates
    const { io } = req.app.get('ws') || {};
    if (io) {
      io.emit('mission:objective', { missionId, objective_id: objId, from: prev, to: state });
      io.to('mission:all').emit('mission:objective', { missionId, objective_id: objId, from: prev, to: state });
      io.to(`mission:${missionId}`).emit('mission:objective', { missionId, objective_id: objId, from: prev, to: state });
      io.emit('mission:progress', { missionId, progress_pct: Number(after[0]?.progress_pct ?? 0) });
      io.to('mission:all').emit('mission:progress', { missionId, progress_pct: Number(after[0]?.progress_pct ?? 0) });
      io.to(`mission:${missionId}`).emit('mission:progress', { missionId, progress_pct: Number(after[0]?.progress_pct ?? 0) });
    }

    res.json({ ok: true, id: objId, state });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

/* POST /api/missions/:id/events { kind, payload } */
router.post('/:id/events', async (req, res, next) => {
  const missionId = Number(req.params.id);
  const { kind, payload } = req.body ?? {};
  if (!kind) return res.status(400).json({ error: 'missing_kind' });

  try {
    const ins = await query(
      `INSERT INTO mission_event (mission_id, kind, payload)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id`,
      [missionId, kind, payload ? JSON.stringify(payload) : null]
    );
    res.status(201).json({ id: ins.rows[0].id });
  } catch (err) { next(err); }
});

export default router;
