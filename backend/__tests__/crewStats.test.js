// backend/tests/crew.stats.e2e.test.js
import request from 'supertest';
import app from '../src/app.js';
import { query } from '../database/db.js';

let crewId;
const name = 'Test Med Crew';

beforeAll(async () => {
  // Ensure a crew exists (and mark active=true so /crew/stats includes it)
  const q = await query('SELECT id FROM crew WHERE name = $1 LIMIT 1', [name]);
  crewId = q.rows[0]?.id ?? (
    await query(
      // if your schema doesn’t require role/deck_zone, this still works
      'INSERT INTO crew (name, role, deck_zone, active) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, 'Ops', 'Cargo', true]
    )
  ).rows[0].id;

  // If your schema has an `active` column, make sure it's TRUE
  try {
    await query('UPDATE crew SET active = TRUE WHERE id = $1', [crewId]);
  } catch { /* column might not exist in your schema; ignore */ }
});

test('returns one row per crew with full name and latest metrics', async () => {
  const now = new Date().toISOString();

  // 1) Ingest some fresh vitals for this crew (same style as your ingest test)
  const payload = {
    metrics: [
      { crewId, metric: 'heart_rate', ts: now, value: 76, unit: 'bpm' },
      { crewId, metric: 'o2_sat',     ts: now, value: 97, unit: '%'   },
      { crewId, metric: 'body_temp',  ts: now, value: 36.9, unit: '°C' },
    ],
  };

  const ingest = await request(app)
    .post('/api/internal/telemetry/ingest')
    .set('authorization', `Bearer ${process.env.INGEST_TOKEN || 'dev_only_change_me_please'}`)
    .send(payload);

  if (ingest.status !== 202) {
    // Helpful debug if ingest fails in CI
    // eslint-disable-next-line no-console
    console.log('INGEST ERROR:', ingest.body);
  }
  expect(ingest.status).toBe(202);

  // 2) Query the new stats endpoint (should include names)
  const res = await request(app)
    .get('/api/crew/stats?metrics=heart_rate,o2_sat,temp_core');

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  const row = res.body.find(r => r.crewId === crewId || r.name === name);
  expect(row).toBeTruthy();

  // Full name present
  expect(row.name).toBe(name);

  // Latest values present (numbers)
  expect(row.heart_rate).toBeDefined();
  expect(row.o2_sat).toBeDefined();
  expect(row.body_temp).toBeDefined();

  // Basic sanity on values we just ingested
  expect(Number(row.heart_rate)).toBe(76);
  expect(Number(row.o2_sat)).toBe(97);
});
