// backend/scripts/migrate.js
import '../loadEnv.js';
import { ensureSchema } from '../database/init.js';
import { URL } from 'node:url';
import pg from 'pg';

async function ensureDatabaseExists() {
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) throw new Error('DATABASE_URL not set');

  try {
    // Try connecting; if it works, DB exists.
    const test = new pg.Client({ connectionString: targetUrl, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false });
    await test.connect();
    await test.end();
    return; // DB exists
  } catch (e) {
    // If the error is "database does not exist" (3D000), attempt to create it
    const code = e?.code || e?.original?.code;
    if (code !== '3D000') throw e;

    const u = new URL(targetUrl);
    const dbname = u.pathname.replace(/^\//, '');
    const adminUrl = new URL(targetUrl);
    adminUrl.pathname = '/postgres';

    console.log(`[migrate] target DB "${dbname}" missing; attempting CREATE DATABASE via ${adminUrl.href.replace(/\/\/.*@/, '//***@')}`);
    try {
      const admin = new pg.Client({ connectionString: adminUrl.toString(), ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false });
      await admin.connect();
      await admin.query(`CREATE DATABASE ${pg.Client.prototype.escapeIdentifier ? pg.Client.prototype.escapeIdentifier(dbname) : `"${dbname.replace(/"/g, '""')}"`}`);
      await admin.end();
      console.log(`[migrate] created database "${dbname}"`);
    } catch (e2) {
      console.warn('[migrate] could not create database (likely no perms on managed DB). Proceeding to schema migration attempt anyway:', e2?.message || e2);
    }
  }
}

const seed = process.env.SEED === 'true';
ensureDatabaseExists()
  .then(() => ensureSchema({ seed }))
  .then(() => { console.log('[migrate] done'); process.exit(0); })
  .catch((err) => { console.error('[migrate] error:', err?.stack || err?.message || err); process.exit(1); });
