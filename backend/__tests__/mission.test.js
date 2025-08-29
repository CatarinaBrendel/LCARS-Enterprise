// backend/__tests__/mission.test.js
import request from 'supertest';
import app from '../src/app.js';
import { query } from '../database/db.js';

let missionId;
let objIds = [];

async function getMissionEvents(mid) {
  const { rows } = await query(
    `SELECT kind, at, payload::text AS payload
       FROM mission_event
      WHERE mission_id = $1
      ORDER BY at ASC, id ASC`,
    [mid]
  );
  return rows.map(r => ({
    ...r,
    payload: r.payload ? JSON.parse(r.payload) : null
  }));
}

async function getObjectives(mid) {
  const { rows } = await query(
    `SELECT id, state
       FROM mission_objective
      WHERE mission_id = $1
      ORDER BY priority DESC, id ASC`,
    [mid]
  );
  return rows;
}

async function countObjectiveStateEvents(missionId, objId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n
       FROM mission_event
      WHERE mission_id = $1
        AND kind = 'objective_state'
        AND (payload->>'objective_id')::bigint = $2`,
    [missionId, objId]
  );
  return rows[0].n;
}

beforeAll(async () => {
  // Stable test code. Add a worker suffix so parallel Jest workers don't race on the same code.
  const CODE = `TEST-MISS-${process.env.JEST_WORKER_ID || 1}`;

  // 1) Idempotent + parallel-safe mission seed
  const ins = await query(
    `
    INSERT INTO mission (code, stardate, sector, authority, status, started_at)
    VALUES ($1, 9000.0, 'Alpha', 'Starfleet', 'in_progress', NOW())
    ON CONFLICT (code)
      DO UPDATE SET
        -- no-op update keeps row the same, but RETURNING works on the existing row
        code = EXCLUDED.code
    RETURNING id
    `,
    [CODE]
  );

  // If for any reason RETURNING didn't produce a row (it should), SELECT as a fallback.
  if (!ins.rows[0]?.id) {
    const sel = await query(`SELECT id FROM mission WHERE code = $1`, [CODE]);
    if (!sel.rows[0]) throw new Error("Mission upsert failed to return or find id");
    missionId = sel.rows[0].id;
  } else {
    missionId = ins.rows[0].id;
  }

  // 2) Objectives — avoid duplicates when tests re-run
  // If you have (mission_id, title) unique, use ON CONFLICT; otherwise do a cheap “insert-if-missing”.
  await query(
    `
    INSERT INTO mission_objective (mission_id, title, details, state, priority)
    VALUES
      ($1, 'Objective A', 'demo', 'in_progress', 100),
      ($1, 'Objective B', 'demo', 'not_started', 80),
      ($1, 'Objective C', 'demo', 'blocked', 60)
    ON CONFLICT DO NOTHING
    `,
    [missionId]
  );

  // Read back the three (either new or existing)
  const objs = await query(
    `SELECT id FROM mission_objective WHERE mission_id = $1 ORDER BY priority DESC, id ASC`,
    [missionId]
  );
  objIds = objs.rows.map((r) => r.id);

  // 3) Seed a 'created' event only if not already there (idempotent)
  await query(
    `
    INSERT INTO mission_event (mission_id, kind, payload)
    SELECT $1, 'created', '{"seed":true}'::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM mission_event WHERE mission_id = $1 AND kind = 'created'
    )
    `,
    [missionId]
  );
});


test('GET /api/missions/current returns snapshot with objectives and progress', async () => {
  const res = await request(app).get('/api/missions/current');
  expect(res.status).toBe(200);

  expect(res.body).toHaveProperty('id', missionId);
  expect(Array.isArray(res.body.objectives)).toBe(true);
  expect(res.body.objectives.length).toBeGreaterThanOrEqual(3);
  expect(res.body).toHaveProperty('progress_pct'); // from mission_progress view
});

test('GET /api/missions/:id returns same snapshot', async () => {
  const res = await request(app).get(`/api/missions/${missionId}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('id', missionId);
  expect(Array.isArray(res.body.teams)).toBe(true); // empty array OK
  // recent events (created + anything else)
  expect(Array.isArray(res.body.events)).toBe(true);
});

test('PATCH /api/missions/:id can set status=hold and logs event', async () => {
  const r = await request(app)
    .patch(`/api/missions/${missionId}`)
    .send({ status: 'hold' });
  expect(r.status).toBe(200);
  expect(r.body).toHaveProperty('ok', true);

  const ev = await getMissionEvents(missionId);
  expect(ev.map(e => e.kind)).toContain('hold');

  // calling again with same status is idempotent (no new event)
  const before = ev.filter(e => e.kind === 'hold').length;
  const r2 = await request(app)
    .patch(`/api/missions/${missionId}`)
    .send({ status: 'hold' });
  expect(r2.status).toBe(200);

  const ev2 = await getMissionEvents(missionId);
  const after = ev2.filter(e => e.kind === 'hold').length;
  expect(after).toBe(before);
});

test('PATCH /api/missions/:id -> status=in_progress (resume) logs resume event', async () => {
  const r = await request(app)
    .patch(`/api/missions/${missionId}`)
    .send({ status: 'in_progress' });
  expect(r.status).toBe(200);

  const ev = await getMissionEvents(missionId);
  expect(ev.map(e => e.kind)).toContain('resume');
});

test('PATCH /api/missions/:id/objectives/:objId transitions state and logs objective_state', async () => {
  const obj = objIds[1]; // B: not_started -> in_progress

  const first = await request(app)
    .patch(`/api/missions/${missionId}/objectives/${obj}`)
    .send({ state: 'in_progress' });
  expect(first.status).toBe(200);
  expect(first.body).toHaveProperty('ok', true);

  // DB-level assertion via JSONB filter
  const n1 = await countObjectiveStateEvents(missionId, obj);
  expect(n1).toBeGreaterThanOrEqual(1);

  // Idempotent: same state again should NOT add another event
  const firstCount = n1;
  const again = await request(app)
    .patch(`/api/missions/${missionId}/objectives/${obj}`)
    .send({ state: 'in_progress' });
  expect(again.status).toBe(200);

  const n2 = await countObjectiveStateEvents(missionId, obj);
  expect(n2).toBe(firstCount); // no duplicate

  // Move to done and confirm state changed
  const done = await request(app)
    .patch(`/api/missions/${missionId}/objectives/${obj}`)
    .send({ state: 'done' });
  expect(done.status).toBe(200);

  const states = (await getObjectives(missionId)).reduce((acc, o) => ({ ...acc, [o.id]: o.state }), {});
  expect(states[obj]).toBe('done');
});

test('POST /api/missions/:id/events appends free-form event', async () => {
  const r = await request(app)
    .post(`/api/missions/${missionId}/events`)
    .send({ kind: 'note', payload: { message: 'Hello LCARS' } });
  expect(r.status).toBe(201);
  expect(r.body).toHaveProperty('id');

  const ev = await getMissionEvents(missionId);
  expect(ev.map(e => e.kind)).toContain('note');
});

test('PATCH /api/missions/:id -> status=completed sets ended_at and logs completed', async () => {
  const r = await request(app)
    .patch(`/api/missions/${missionId}`)
    .send({ status: 'completed' });
  expect(r.status).toBe(200);

  const { rows } = await query('SELECT ended_at, status FROM mission WHERE id = $1', [missionId]);
  expect(rows[0].status).toBe('completed');
  expect(rows[0].ended_at).toBeTruthy();

  const ev = await getMissionEvents(missionId);
  expect(ev.map(e => e.kind)).toContain('completed');
});
