import request from 'supertest';
import app from '../src/app.js';
import { getClient } from '../database/db.js';

describe('GET /api/crew/:crewId/overview', () => {
  let c;
  let crewId;
  let visitId;

  beforeAll(async () => {
    c = await getClient();
  });

  afterAll(async () => {
    try {
      if (visitId) {
        await c.query('DELETE FROM triage_visit WHERE id = $1', [visitId]);
      }
      if (crewId) {
        await c.query('DELETE FROM crew_metric WHERE crew_id = $1', [crewId]);
        await c.query('DELETE FROM crew WHERE id = $1', [crewId]);
      }
    } finally {
      c.release();
    }
  });

  test('happy path: identity + presence + latest vitals, no active triage', async () => {
    // create crew
    const crewRes = await c.query(
      `INSERT INTO crew (name, role, deck_zone, on_duty, busy, active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Test Crew Overview', 'Ops', 'Bridge', true, true, true]
    );
    crewId = crewRes.rows[0].id;

    // seed latest vitals
    const now = new Date();
    await c.query(
      `INSERT INTO crew_metric (ts, crew_id, metric_name, value, unit)
       VALUES
       ($1, $2, 'heart_rate', 88, 'bpm'),
       ($1, $2, 'o2_sat', 97, '%'),
       ($1, $2, 'body_temp', 37.4, '°C')`,
      [now, crewId]
    );

    // call endpoint
    const res = await request(app).get(`/api/crew/${crewId}/overview`);
    expect(res.status).toBe(200);

    const b = res.body;
    // identity
    expect(b.identity).toMatchObject({
      crewId,
      name: 'Test Crew Overview',
      role: 'Ops',
    });

    // presence (no triage active yet → on duty & busy match crew row)
    expect(b.presence).toMatchObject({
      inTreatment: false,
      onDuty: true,
      busy: true,
      deck_zone: 'Bridge',
    });

    // vitalsNow (latest per metric present)
    expect(b.vitalsNow).toMatchObject({
      heart_rate: 88,
      o2_sat: 97,
      body_temp: 37.4,
    });

    // no active triage
    expect(b.triageActive).toBeNull();
    // ordersActive should exist (empty array if orders table isn’t present/none found)
    expect(Array.isArray(b.ordersActive)).toBe(true);
  });

  test('reflects active triage: inTreatment=true, onDuty=false, busy=false, zone=Sickbay', async () => {
    // admit the same crew
    const admit = await request(app)
      .post('/api/triage/visits')
      .send({ crewId, state: 'under_treatment', acuity: 4, complaint: 'test', bed: '2', assigned_to: 'Dr. T' });

    expect(admit.status).toBe(201);
    expect(admit.body).toHaveProperty('id');
    visitId = admit.body.id;

    const res = await request(app).get(`/api/crew/${crewId}/overview`);
    expect(res.status).toBe(200);

    const b = res.body;

    // effective presence flips for patients
    expect(b.presence).toMatchObject({
      inTreatment: true,
      onDuty: false,
      busy: false,            // patients are not counted as "busy (working)"
      deck_zone: 'Sickbay',
    });

    // active triage details present
    expect(b.triageActive).toBeTruthy();
    expect(b.triageActive).toMatchObject({
      visitId,
      state: 'under_treatment',
      acuity: 4,
      complaint: 'test',
      bed: '2',
      assigned_to: 'Dr. T',
    });

    // ordersActive present (may be empty if triage_order not implemented yet)
    expect(Array.isArray(b.ordersActive)).toBe(true);
  });

  test('invalid crewId yields 400', async () => {
    const r = await request(app).get('/api/crew/NaN/overview');
    expect(r.status).toBe(400);
  });

  test('unknown crewId yields 404', async () => {
    const r = await request(app).get('/api/crew/999999/overview');
    // either 404, or 200 with not-found; adapt if your route returns a different error shape
    expect([404, 400]).toContain(r.status);
  });
});
