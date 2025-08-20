// backend/database/init.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// migrations live in backend/database/migrations
const MIGRATIONS_DIR = path.resolve(__dirname, './migrations');

export async function ensureSchema({ seed = true } = {}) {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations dir not found: ${MIGRATIONS_DIR}`);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+_.*\.sql$/i.test(f))
    .sort();

  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    await query(sql);
    console.log(`Migration ${f}: OK`);
  }

  if (seed) {
    const seeds = files.filter(f => /seed/i.test(f));
    for (const f of seeds) {
      console.log(`Seed ${f}: OK (included above)`);
    }
  }
}
