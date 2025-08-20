// backend/tests/ingest.e2e.test.js
import request from 'supertest';
import app from '../src/app.js';
import { initDb, truncateData, closeDb } from './_db.js';
import { ensureSchema } from '../database/init.js';
import { endPool } from '../database/db.js'; // add endPool() if you don't have it


const AUTH = `Bearer ${process.env.INGEST_TOKEN || 'dev_only'}`;

beforeAll(async () => {
  await ensureSchema({ seed: true }); // tables + seed crew
});

afterAll(async () => {
  await endPool?.(); // closes pg Pool so Jest can exit cleanly
});

beforeEach(async () => { await truncateData(); });

it('ingests and queries data', async () => {
  const now = new Date().toISOString();
  await request(app)
    .post('/api/internal/telemetry/ingest')
    .set('Authorization', AUTH)
    .send({
      ts: now,
      metrics: [
        { crew_id: 1, metric: 'heart_rate', value: 80, unit: 'bpm', ts: now },
        { crew_id: 1, metric: 'location_zone', text_value: 'Bridge', ts: now }
      ],
      events: [
        { crew_id: 1, event_type: 'high_stress', severity: 3, details: { stress_index: 78 }, ts: now }
      ]
    })
    .expect(202);

  const latest = await request(app)
    .get('/api/crew/latest?metrics=heart_rate,location_zone')
    .expect(200);

  expect(latest.body.data.some(r => r.metric === 'heart_rate' && r.value === 80)).toBe(true);
  expect(latest.body.data.some(r => r.metric === 'location_zone' && r.text_value === 'Bridge')).toBe(true);
});
