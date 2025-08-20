import { ensureSchema } from '../database/init.js';
import { query, endPool } from '../database/db.js';

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
  await query('TRUNCATE crew_metric RESTART IDENTITY CASCADE;');
  await query('TRUNCATE crew_event  RESTART IDENTITY CASCADE;');
  // keep crew seed so crew_id=1 exists in tests
}

export async function closeDb() {
  // optional, but avoids open handles warning
  await endPool?.();
}
