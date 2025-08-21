// backend/database/init.js
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getClient } from './db.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ensureSchema({ seed = false } = {}) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // resolves to <repo>/backend/database/migrations
  const migDir = path.resolve(__dirname, './migrations');

  // helpful logging so you can see what runs and against which DB
  const maskedUrl = (process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@');
  console.log('[migrate] DB:', maskedUrl);
  console.log('[migrate] dir:', migDir);

  const files = (await fs.readdir(migDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

    if (!files.includes('004_retention.sql')) {
      throw new Error(`[migrate] 004_retention.sql not found in ${migDir}. Got: ${files.join(', ')}`);
    }

  for (const f of files) {
    if (!seed && /seed/i.test(f)) {
      console.log('[migrate] skip seed:', f);
      continue;
    }
    const sql = await fs.readFile(path.join(migDir, f), 'utf8');
    console.log('[migrate] applying:', f);
    try {
      await query(sql);
    } catch (error) {
      console.error(`[migrate] FAILED: ${f} -> ${error.message}`);
      throw error;
    }

    // Assert the retention functions exist (so tests won’t blow up later)
    const check = await query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public'
        AND p.proname IN ('prune_crew_metric_age_with_floor','prune_crew_event_age_with_floor')
      ORDER BY 1;
    `);
    if (check.rowCount < 2) {
      throw new Error('[migrate] retention functions missing in DB. Did 004_retention.sql actually create them?');
    } else {
      console.log('[migrate] retention functions present:', check.rows.map(r => `${r.proname}(${r.args})`));
    }
  }

  // backend/database/init.js
  const filesToLog = (await fs.readdir(migDir)).filter(f => f.endsWith('.sql')).sort();
  console.log('[migrate] files:', filesToLog);

}