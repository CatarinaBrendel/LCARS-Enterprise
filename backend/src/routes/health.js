import { Router } from 'express';
import { query } from '../../database/db.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

router.get('/db', async (_req, res, next) => {
  try {
    const r = await query('SELECT 1 as ok, version() as pg_version');
    res.json(r.rows[0]); // { ok:1, pg_version:"PostgreSQL ..." }
  } catch (err) {
    next(err);
  }
});

export default router;
