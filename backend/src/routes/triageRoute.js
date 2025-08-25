import { Router } from 'express';
import { getClient, query } from '../../database/db.js';

const router = Router();

// Create (admit/triage/under_treatment)
router.post('/visits', async (req, res, next) => {
  const { crewId, state='under_treatment', acuity=3, complaint='', bed=null, assigned_to=null } = req.body || {};
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: [{ id }] } = await client.query(
      `INSERT INTO triage_visit (crew_id, state, acuity, complaint, bed, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [crewId, state, acuity, complaint, bed, assigned_to]
    );
    
    await client.query(
      `INSERT INTO triage_visit_event (visit_id, kind) VALUES ($1, $2)`,
      [id, state]
    );

    await client.query('COMMIT');
    res.status(201).json({ id });
    // Presence WS will auto-fire via LISTEN/NOTIFY trigger.
  } catch (e) {
    await client.query('ROLLBACK'); next(e);
  } finally { client.release(); }
});

// Update state / fields (e.g., move to recovering)
router.patch('/visits/:id', async (req, res, next) => {
  const { id } = req.params;
  const { state, acuity, bed, assigned_to, complaint, discharge=false } = req.body || {};
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // 1) Lock and read the previous state so we can tell if it changed
    const prev = await client.query(
      'SELECT state, ended_at FROM triage_visit WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (prev.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'visit not found' });
    }
    const prevState = prev.rows[0].state;

    // 2) Apply the update
    const { rows: [row] } = await client.query(
      `UPDATE triage_visit
        SET state       = COALESCE($2,state),
            acuity      = COALESCE($3,acuity),
            bed         = COALESCE($4,bed),
            assigned_to = COALESCE($5,assigned_to),
            complaint   = COALESCE($6,complaint),
            ended_at    = CASE
                            WHEN $7::boolean IS TRUE OR $2 = 'discharged'
                              THEN now()
                            ELSE ended_at
                          END
      WHERE id = $1
      RETURNING id, crew_id, state, ended_at`,
      [id, state, acuity, bed, assigned_to, complaint, discharge]
    );

    // 3) Write history/events BEFORE COMMIT (only if state truly changed)
    if (state && state !== prevState) {
      await client.query(
        `INSERT INTO triage_visit_event (visit_id, kind) VALUES ($1, $2)`,
        [id, state]
      );
    }
    
    if (discharge === true || state === "discharged") {
      if(state !== 'discharged') {
        await client.query(
          `INSERT INTO triage_visit_event (visit_id, kind) VALUES ($1, 'discharged)`, [id]
        );
      }
    }

    await client.query('COMMIT');
    
    res.json({ ok: true, id: row?.id, state: row.state, ended_at: row.ended_at});
    // Presence WS will auto-fire via LISTEN/NOTIFY trigger.
  } catch (e) {
    await client.query('ROLLBACK'); next(e);
  } finally { client.release(); }
});

// List active visits (for Sickbay board)
router.get('/visits', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT v.*, c.name AS crew_name
      FROM triage_visit v
      JOIN crew c ON c.id = v.crew_id
      WHERE v.ended_at IS NULL
      ORDER BY v.updated_at DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

// Visit history per crew
router.get('/crew/:crewId/visits', async (req, res, next) => {
    const { crewId } = req.params;
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 50);
    const cursorStartedAt = req.query.cursor_started_at; // ISO string
    const cursorId = req.query.cursor_id; // number

    const whereCursor = cursorStartedAt && cursorId
    ? `AND (v.started_at, v.id) < ($2::timestamptz, $3::int)`
    : '';
    const params = cursorStartedAt && cursorId
    ? [crewId, cursorStartedAt, cursorId, limit]
    : [crewId, limit];

    const sql = `
      SELECT
        v.id, v.crew_id, v.started_at, v.ended_at, v.acuity, v.complaint,
        /* optional: bed, assigned_to if you want to show them */
        COALESCE((
          SELECT array_agg(e.kind ORDER BY e.at)
          FROM triage_visit_event e
          WHERE e.visit_id = v.id
        ), ARRAY[v.state]) AS state_path
      FROM triage_visit v
      WHERE v.crew_id = $1
      ${whereCursor}
      ORDER BY v.started_at DESC, v.id DESC
      LIMIT $${params.length}
    `;

    try {
      const { rows } = await query(sql, params);
      const last = rows[rows.length - 1];
      const nextCursor = last
        ? { cursor_started_at: last.started_at, cursor_id: last.id }
        : null;
      res.json({ items: rows, nextCursor });
    } catch (e) { next(e); }
});

export default router;
