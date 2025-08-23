// backend/database/init.js
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getClient } from './db.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ensureSchema({ seed = false } = {}) {
  const migDir = path.resolve(__dirname, './migrations');

  // helpful logging so you can see what runs and against which DB
  const maskedUrl = (process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@');
  console.log('[migrate] DB:', maskedUrl);
  console.log('[migrate] dir:', migDir);

    const files = (await fs.readdir(migDir))
      // accept .sql, .SQL, .Sql, etc.
      .filter(f => /\.sql$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  
    console.log('[migrate] files:', files);
    
    const client = await getClient();
    try {
      await client.query('BEGIN');

      for (const f of files) {
        if (!seed && /seed/i.test(f)) {
          console.log('[migrate] skip seed:', f);
          continue;
        }
        const sql = await fs.readFile(path.join(migDir, f), 'utf8');
        console.log('[migrate] applying:', f);
        await client.query(sql);            // ← any error here aborts
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[migrate] FAILED while applying migrations:', error.message);
      throw error;
    } finally {
      client.release();
    }

    // Now that ALL migrations ran, assert retention functions exist
    const check = await getClient();
    try {
      const { rows = [], rowCount = 0 } = await check.query(`
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname IN (
          'prune_crew_metric_age_with_floor',
          'prune_crew_event_age_with_floor'
        )
          AND n.nspname = 'public'
        ORDER BY 1;
      `);
      if (rowCount < 2) {
        console.error('[migrate] functions found so far:', rows.map(r => `${r.proname}(${r.args})`));
        throw new Error('[migrate] retention functions missing in DB. Did 004_retention.sql actually create them?');
      }
      console.log('[migrate] retention functions present:', rows.map(r => `${r.proname}(${r.args})`));
    } finally {
      check.release();
    }
}