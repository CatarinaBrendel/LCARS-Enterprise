import { Router } from 'express';
import { query } from '../../database/db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    await query('select 1');
    res.json({ ok: true, db: 'ok', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down', error: e.message });
  }
});

export default router;
