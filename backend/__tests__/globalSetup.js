// __tests__/globalSetup.js
import '../loadEnv.js';
import { ensureSchema } from '../database/init.js';
import { Pool } from 'pg';
import { URL } from 'url';

const sslOpt = process.env.PGSSLMODE === 'require'
  ? { rejectUnauthorized: false }
  : false;

function withDb(cs, name) {
  const u = new URL(cs);
  u.pathname = `/${encodeURIComponent(name)}`;
  return u.toString();
}

async function waitForServer(cs, tries = 180, delayMs = 500) {
  const serverCS = withDb(cs, 'postgres');
  let lastErr;
  for (let i = 0; i < tries; i++) {
    const pool = new Pool({ connectionString: serverCS, ssl: sslOpt, connectionTimeoutMillis: 2000 });
    try {
      await pool.query('select 1');
      return;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, delayMs));
    } finally {
      await pool.end().catch(() => {});
    }
  }
  const msg = lastErr ? `${lastErr.name}: ${lastErr.message}` : '';
  throw new Error(`Postgres server not ready. Last error: ${msg}`);
}

async function ensureDb(cs) {
  const target = new URL(cs).pathname.replace(/^\//, '');
  const serverCS = withDb(cs, 'postgres');
  const pool = new Pool({ connectionString: serverCS, ssl: sslOpt });
  try {
    const { rows } = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [target]);
    if (rows.length === 0) {
      await pool.query(`CREATE DATABASE "${target.replace(/"/g, '""')}"`);
      console.log(`[globalSetup] created database "${target}"`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

export default async function () {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error('DATABASE_URL missing in globalSetup');
  console.log('[globalSetup] DATABASE_URL:', cs.replace(/\/\/.*@/, '//***@'));

  // Avoid SSL on container-to-container unless you really need it
  if (process.env.NODE_ENV === 'test' && process.env.PGSSLMODE === 'require') {
    console.warn('[globalSetup] PGSSLMODE=require set; ensure your Postgres accepts SSL inside Docker.');
  }

  await waitForServer(cs);     // server socket up
  await ensureDb(cs);          // database exists
  process.env.START_RETENTION = 'false';
  await ensureSchema({ seed: false });
}
