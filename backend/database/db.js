// backend/database/db.js
import '../loadEnv.js'; 
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000, // don't hang forever
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on('error', (err) => {
  console.error('Unexpected PG error:', err.message);
});


export async function query(text, params) {
  return pool.query(text, params);
}

const _trackedClients = new Set();

export async function getClient() {
  const c = await pool.connect();
  // Wrap release so we can track/auto-clean
  const origRelease = c.release.bind(c);
  c.release = () => {
    _trackedClients.delete(c);
    return origRelease();
  };
  _trackedClients.add(c);
  return c;
}

// Force-release anything left (used by test teardown)
export async function forceReleaseAllClients() {
  for (const c of Array.from(_trackedClients)) {
    try { c.release(); } catch {}
    _trackedClients.delete(c);
  }
}

// endPool should be last, after releasing
export async function endPool() {
  await Promise.race([
    pool.end(),
    new Promise(res => setTimeout(res, 2000)),
  ]);
}