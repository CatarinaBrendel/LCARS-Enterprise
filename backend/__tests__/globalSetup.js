import '../loadEnv.js';
import { ensureSchema } from '../database/init.js';
import { Pool } from 'pg';

// Wait for Postgres inside the container before applying migrations
async function waitForPg(cs, tries = 40, delayMs = 500) {
  const pool = new Pool({
    connectionString: cs,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  });
  try {
    for (let i = 0; i < tries; i++) {
      try { await pool.query('select 1'); return; }
      catch { await new Promise(r => setTimeout(r, delayMs)); }
    }
    throw new Error('Postgres not ready');
  } finally {
    await pool.end().catch(() => {});
  }
}

export default async function () {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing in globalSetup');
  process.env.START_RETENTION = 'false'; // never start cron in tests
  await waitForPg(process.env.DATABASE_URL);
  await ensureSchema({ seed: false });   // ✅ apply once
}
