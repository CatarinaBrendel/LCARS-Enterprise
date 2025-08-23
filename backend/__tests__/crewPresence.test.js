// backend/tests/crew.presence.e2e.test.js
import request from 'supertest';
import app from '../src/app.js';
import { query } from '../database/db.js';

let crewId;
const name = 'Test Presence Crew';

beforeAll(async () => {
  // Ensure a crew exists (active), with a known starting presence state
  const existing = await query('SELECT id FROM crew WHERE name = $1 LIMIT 1', [name]);
  crewId = existing.rows[0]?.id ?? (
    await query(
      `INSERT INTO crew (name, role, deck_zone, active, on_duty, busy)
       VALUES ($1, $2, $3, TRUE, TRUE, FALSE)
       ON CONFLICT (name) DO UPDATE SET active = EXCLUDED.active
       RETURNING id`,
      [name, 'Ops', 'Bridge']
    )
  ).rows[0].id;

  // Normalize starting state (and make sure on_duty/busy columns exist)
  try {
    await query(
      `UPDATE crew
         SET active = TRUE,
             on_duty = TRUE,
             busy = FALSE,
             deck_zone = 'Bridge'
       WHERE id = $1`,
      [crewId]
    );
  } catch {
    // If your schema didn't add presence columns yet, the test will fail later — intended.
  }
});

test('GET /api/crew/presence returns presence fields for active crew', async () => {
  const res = await request(app).get('/api/crew/presence');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  const row = res.body.find(r => r.crewId === crewId || r.name === name);
  expect(row).toBeTruthy();

  // Shape & basic values
  expect(row.name).toBe(name);
  expect(row).toHaveProperty('deck_zone');
  expect(row).toHaveProperty('onDuty');
  expect(row).toHaveProperty('busy');
  expect(row).toHaveProperty('ts');

  // Matches our normalized state
  expect(row.onDuty).toBe(true);
  expect(row.busy).toBe(false);
  expect(typeof row.deck_zone).toBe('string');
});

test('presence updates bump updated_at (trigger) and reflect via endpoint', async () => {
  // Read current updated_at
  const r1 = await query('SELECT updated_at FROM crew WHERE id = $1', [crewId]);
  const t1 = new Date(r1.rows[0].updated_at).getTime();

  // Apply a presence/location change
  await query(
    `UPDATE crew
        SET busy = NOT busy,
            deck_zone = 'Engineering'
      WHERE id = $1`,
    [crewId]
  );

  // Verify DB timestamp advanced
  const r2 = await query(
    'SELECT busy, deck_zone, updated_at FROM crew WHERE id = $1',
    [crewId]
  );
  expect(r2.rows[0].deck_zone).toBe('Engineering');
  const t2 = new Date(r2.rows[0].updated_at).getTime();
  expect(t2).toBeGreaterThan(t1);

  // Endpoint reflects the new state
  const res = await request(app).get('/api/crew/presence');
  expect(res.status).toBe(200);
  const row = res.body.find(r => r.crewId === crewId);
  expect(row).toBeTruthy();
  expect(row.deck_zone).toBe('Engineering');
  // busy was toggled from false -> true (or vice versa). We just assert it matches DB:
  expect(row.busy).toBe(Boolean(r2.rows[0].busy));
});
