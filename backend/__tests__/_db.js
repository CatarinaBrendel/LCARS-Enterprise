import { ensureSchema } from '../database/init.js';
import { query, endPool } from '../database/db.js';

async function waitForPg(cs, tries = 20, delayMs = 500) {
  const p = new Pool({
    connectionString: cs,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });
  try {
    for (let i = 0; i < tries; i++) {
      try { await p.query('select 1'); return; }
      catch { await new Promise(r => setTimeout(r, delayMs)); }
    }
    throw new Error('Postgres not ready after retries');
  } finally { await p.end().catch(()=>{}); }
}

function assertSafeTestDb() {
  const url = new URL(process.env.DATABASE_URL);
  const dbName = url.pathname.replace(/^\//,'');
  if (process.env.NODE_ENV !== 'test' || !/_test$/i.test(dbName)) {
    throw new Error(`Refusing to run tests against non-test DB: ${dbName}`);
  }
}

export async function initDb({ seed = true } = {}) {
  assertSafeTestDb();
  await ensureSchema({ seed });
}

export async function truncateData() {
  assertSafeTestDb();
  await waitForPg(process.env.DATABASE_URL);  
  await query('TRUNCATE crew_metric RESTART IDENTITY CASCADE;');
  await query('TRUNCATE crew_event  RESTART IDENTITY CASCADE;');
  // keep crew seed so crew_id=1 exists in tests
}

export async function closeDb() {
  // optional, but avoids open handles warning
  await endPool?.();
}
