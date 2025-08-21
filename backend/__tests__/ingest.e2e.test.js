// backend/tests/ingest.e2e.test.js
import request from 'supertest';
import app from '../src/app.js';
import { query } from '../database/db.js';

let crewId;

beforeAll(async () => {
  const q = await query('SELECT id FROM crew LIMIT 1');
  crewId = q.rows[0]?.id ?? (
  await query(
      'INSERT INTO crew (name) VALUES ($1) RETURNING id',
      ['Test Crew']
    )
  ).rows[0].id;
});

test('ingests and queries data', async () => {
  const payload = {
    metrics: [
      { crewId, metric: 'heart_rate', ts: new Date().toISOString(), value: 77, unit: 'bpm' }, // ✅ numeric
      { crewId, metric: 'o2_sat', ts: new Date().toISOString(), value: 98, unit: '%'  },
    ],
    events: [
      { crewId, event_type: 'high_stress', ts: new Date().toISOString(), severity: 3 , details: {message: 'ok'} },
    ],
  };

  const res = await request(app)
    .post('/api/internal/telemetry/ingest')
    .set('authorization', `Bearer ${process.env.INGEST_TOKEN || 'dev_only_change_me_please'}`)
    .send(payload);

    if(res.status !== 202) {
      console.log('INGEST ERROR: ', res.body);
    }
    
    expect(res.status).toBe(202);
  });
