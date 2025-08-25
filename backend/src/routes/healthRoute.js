// src/routes/health.js
import { Router } from 'express';
import { query } from '../../database/db.js';

const router = Router();

router.get('/', async (req, res) => {
  let db = 'down';
  try {
    await query('SELECT 1');
    db = 'ok';
  } catch (_) {
    // keep db='down'
  }

  const getReady = req.app.get?.('ready');
  const ready = typeof getReady === 'function' ? !!getReady() : false;
  const now = new Date().toISOString();

  res.status(200).json({
    ok: true,  // liveness
    ready,
    db,        // 'ok' or 'down'
    time: now,               
    ts: now,
    uptime: process.uptime(),
  });
});

export default router;
