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
    const { rows: [row] } = await client.query(
      `UPDATE triage_visit
         SET state = COALESCE($2,state),
             acuity = COALESCE($3,acuity),
             bed = COALESCE($4,bed),
             assigned_to = COALESCE($5,assigned_to),
             complaint = COALESCE($6,complaint),
             ended_at = CASE WHEN $7::boolean IS TRUE THEN now() ELSE ended_at END
       WHERE id = $1
       RETURNING id, crew_id`,
      [id, state, acuity, bed, assigned_to, complaint, discharge]
    );
    await client.query('COMMIT');
    res.json({ ok: true, id: row?.id });
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
  try {
    const { crewId } = req.params;
    const { rows } = await query(`
      SELECT * FROM triage_visit
      WHERE crew_id = $1
      ORDER BY started_at DESC
      LIMIT 50
    `, [crewId]);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
