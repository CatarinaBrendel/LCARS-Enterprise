import { Router } from 'express';
import { query } from '../../database/db.js';

const router = Router();

// GET /api/crew_status
router.get('/', async (_req, res, next) => {
  try {
    const r = await query(
      'SELECT id, name, role, status, last_seen FROM crew_status ORDER BY id'
    );
    res.json(r.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/crew_status
router.post('/', async (req, res, next) => {
  const { name, role = 'Crew', status = 'OK' } = req.body;
  try {
    const r = await query(
      `INSERT INTO crew_status (name, role, status)
       VALUES ($1,$2,$3)
       ON CONFLICT (name) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
       RETURNING *`,
      [name, role, status]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
