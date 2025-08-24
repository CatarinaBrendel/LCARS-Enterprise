import request from 'supertest';
import app from '../src/app.js';
import { getClient } from '../database/db.js';

describe('GET /api/crew/:crewId/series', () => {
  let c;
  let crewId;

  beforeAll(async () => {
    c = await getClient();

    // Create a crew member
    const ins = await c.query(
      `INSERT INTO crew (name, role, deck_zone, on_duty, busy, active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Series Test Crew', 'Ops', 'Bridge', true, false, true]
    );
    crewId = ins.rows[0].id;

    // Seed metrics relative to NOW() to avoid clock skew
    // Seed metrics relative to NOW() to avoid clock skew — single INSERT, many rows
    await c.query(
    `
    INSERT INTO crew_metric (ts, crew_id, metric_name, value, text_value, unit)
    VALUES
        -- heart_rate: 5 points
        (NOW() - INTERVAL '120 seconds', $1, 'heart_rate', 80,   NULL,       'bpm'),
        (NOW() - INTERVAL '90 seconds',  $1, 'heart_rate', 84,   NULL,       'bpm'),
        (NOW() - INTERVAL '60 seconds',  $1, 'heart_rate', 100,  NULL,       'bpm'),
        (NOW() - INTERVAL '30 seconds',  $1, 'heart_rate', 96,   NULL,       'bpm'),
        (NOW() - INTERVAL '5 seconds',   $1, 'heart_rate', 92,   NULL,       'bpm'),

        -- o2_sat: 2 points
        (NOW() - INTERVAL '120 seconds', $1, 'o2_sat',     97,   NULL,       '%'),
        (NOW() - INTERVAL '60 seconds',  $1, 'o2_sat',     96,   NULL,       '%'),

        -- body_temp: 2 points
        (NOW() - INTERVAL '120 seconds', $1, 'body_temp',  37.0, NULL,       '°C'),
        (NOW() - INTERVAL '30 seconds',  $1, 'body_temp',  37.2, NULL,       '°C'),

        -- bp: latest-only string metric
        (NOW() - INTERVAL '90 seconds',  $1, 'bp',         NULL, '118/76',   'mmHg'),
        (NOW() - INTERVAL '20 seconds',  $1, 'bp',         NULL, '120/78',   'mmHg')
    `,
    [crewId]
    );
  });

  afterAll(async () => {
    try {
      if (crewId) {
        await c.query('DELETE FROM crew_metric WHERE crew_id = $1', [crewId]);
        await c.query('DELETE FROM crew WHERE id = $1', [crewId]);
      }
    } finally {
      c.release();
    }
  });

  function expectAscendingT(series) {
    for (let i = 1; i < series.length; i++) {
      const prev = Date.parse(series[i - 1].t);
      const cur = Date.parse(series[i].t);
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  }

  test('returns bucketed series for numeric metrics + latest BP (window=5m, bucket=30s)', async () => {
    const res = await request(app)
      .get(`/api/crew/${crewId}/series`)
      .query({
        metrics: 'heart_rate,o2_sat,body_temp,bp',
        window: '5m',
        bucket: '30s',
      });

    expect(res.status).toBe(200);
    const body = res.body;

    // Keys exist
    expect(body).toHaveProperty('heart_rate');
    expect(body).toHaveProperty('o2_sat');
    expect(body).toHaveProperty('body_temp');
    expect(body).toHaveProperty('bp');

    // Non-empty arrays for numeric metrics
    expect(Array.isArray(body.heart_rate)).toBe(true);
    expect(body.heart_rate.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(body.o2_sat)).toBe(true);
    expect(body.o2_sat.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.body_temp)).toBe(true);
    expect(body.body_temp.length).toBeGreaterThanOrEqual(1);

    // BP is latest-only within window
    expect(Array.isArray(body.bp)).toBe(true);
    expect(body.bp.length).toBe(1);
    expect(typeof body.bp[0].v === 'string' || body.bp[0].v === null).toBe(true);

    // Time ascending
    expectAscendingT(body.heart_rate);
    expectAscendingT(body.o2_sat);
    expectAscendingT(body.body_temp);

    // Last bucket should reflect the most recent values we inserted
    const lastHR = body.heart_rate[body.heart_rate.length - 1].v;
    
    // Accept either the last value or the avg with the previous one.
    expect(Math.round(lastHR)).toBeGreaterThanOrEqual(92);
    expect(Math.round(lastHR)).toBeLessThanOrEqual(96);


    const lastTemp = body.body_temp[body.body_temp.length - 1].v;
    expect(Number(lastTemp).toFixed(1)).toBe('37.2'); // latest temp 37.2

    // Latest BP string should be the most recent inserted
    expect(body.bp[0].v).toBe('120/78');
  });

  test('respects narrower window (60s) which drops older points', async () => {
    await c.query(
        `INSERT INTO crew_metric (ts, crew_id, metric_name, value, unit)
        VALUES (NOW() - INTERVAL '15 seconds', $1, 'o2_sat', 96, '%')`,
        [crewId]
    );
    
    const res = await request(app)
      .get(`/api/crew/${crewId}/series`)
      .query({
        metrics: 'heart_rate,o2_sat',
        window: '60s',
        bucket: '30s',
      });

    expect(res.status).toBe(200);
    const { heart_rate, o2_sat } = res.body;

    // Only recent buckets should remain (roughly last two buckets)
    expect(heart_rate.length).toBeGreaterThanOrEqual(1);
    expect(heart_rate.length).toBeLessThanOrEqual(3); // 60s / 30s ≈ 2 buckets (allow 3 for boundary)
    expectAscendingT(heart_rate);

    // o2_sat has a point at -60s, so expect at least one bucket
    expect(o2_sat.length).toBeGreaterThanOrEqual(1);
    expectAscendingT(o2_sat);
  });

  test('rejects when no valid metrics requested', async () => {
    const res = await request(app)
      .get(`/api/crew/${crewId}/series`)
      .query({ metrics: 'foo,bar', window: '5m', bucket: '30s' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
