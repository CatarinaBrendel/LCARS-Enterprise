// backend/src/routes/mission.js
import express from 'express';
import { query } from '../../database/db.js';

const router = express.Router();

/* Helpers */
async function loadMissionSnapshot(missionId) {
  const m = await query(
    `SELECT m.*, p.progress_pct
       FROM mission m
       LEFT JOIN mission_progress p ON p.mission_id = m.id
      WHERE m.id = $1`,
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

/* GET /api/missions/current
   Picks the "current" mission preferring in_progress, then hold, then planned (latest). */
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

/* GET /api/missions/:id */
router.get('/:id', async (req, res, next) => {
  try {
    const snap = await loadMissionSnapshot(Number(req.params.id));
    if (!snap) return res.status(404).json({ error: 'not_found' });
    res.json(snap);
  } catch (err) { next(err); }
});

/* PATCH /api/missions/:id  { status? }
   Writes status changes and logs mission_event accordingly. */
router.patch('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  if (!['planned','in_progress','hold','completed','aborted'].includes(status)) {
    return res.status(400).json({ error: 'bad_status' });
  }

  const statusToEvent = {
    planned: 'note',
    in_progress: 'resume',
    hold: 'hold',
    completed: 'completed',
    aborted: 'aborted',
  };

  try {
    await query('BEGIN');

    const cur = await query('SELECT status FROM mission WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows[0]) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }
    const prev = cur.rows[0].status;
    if (prev === status) {
      await query('COMMIT');
      return res.json({ ok: true, id, status });
    }

    const fields = ['status = $2', 'updated_at = NOW()'];
    const vals = [id, status];
    if (status === 'in_progress' && prev !== 'in_progress') fields.push('started_at = COALESCE(started_at, NOW())');
    if ((status === 'completed' || status === 'aborted') && prev !== status) fields.push('ended_at = COALESCE(ended_at, NOW())');

    await query(`UPDATE mission SET ${fields.join(', ')} WHERE id = $1`, vals);

    await query(
      `INSERT INTO mission_event (mission_id, kind, payload)
       VALUES ($1, $2, $3::jsonb)`,
      [id, statusToEvent[status], JSON.stringify({ from: prev, to: status })]
    );

    await query('COMMIT');
    res.json({ ok: true, id, status });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

/* PATCH /api/missions/:id/objectives/:objId  { state }
   Idempotent: no duplicate event if state doesn’t change. */
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

    await query('COMMIT');
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