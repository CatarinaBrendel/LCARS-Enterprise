// backend/database/init.js
import { query } from './db.js';

const ddl = `
CREATE TABLE IF NOT EXISTS crew_status (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT        NOT NULL UNIQUE,
  role      TEXT        NOT NULL CHECK (role IN ('Admin','Officer','Crew')),
  status    TEXT        NOT NULL DEFAULT 'OK',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Make sure (name) is unique even if the table existed before
CREATE UNIQUE INDEX IF NOT EXISTS crew_status_name_unique ON crew_status(name);
`;

export async function ensureSchema() {
  await query(ddl);
  // optional: seed one row so the UI has something to show
  try {
    await query(
    `INSERT INTO crew_status (name, role, status)
     VALUES ($1,$2,$3)
     ON CONFLICT (name) DO NOTHING`,
    ['Philipp Brendel', 'Admin', 'OK']
  );
  } catch (error) {
    console.error('Seed failed: ', error.message);
  }
}
