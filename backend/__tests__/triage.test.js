import request from 'supertest';
import app from '../src/app.js';
import { query } from '../database/db.js';

let crewId;
let visitId;
const name = 'Test Triage Crew';

async function getEventsForVisit(visitId) {
  const { rows } = await query(
    `SELECT kind, at FROM triage_visit_event WHERE visit_id = $1 ORDER BY at ASC, id ASC`,
    [visitId]
  );
  return rows;
}

async function getVisitRow(visitId) {
  const { rows } = await query(`SELECT * FROM triage_visit WHERE id = $1`, [visitId]);
  return rows[0] ?? null;
}


beforeAll(async () => {
  // Ensure a crew member exists with a known baseline (active, on duty, not busy, in Bridge)
  const existing = await query('SELECT id FROM crew WHERE name = $1 LIMIT 1', [name]);
  crewId = existing.rows[0]?.id ?? (
    await query(
      `INSERT INTO crew (name, role, deck_zone, active, on_duty, busy)
       VALUES ($1, 'Med', 'Bridge', TRUE, TRUE, FALSE)
       ON CONFLICT (name) DO UPDATE SET active = EXCLUDED.active
       RETURNING id`,
      [name]
    )
  ).rows[0].id;

  // Normalize baseline presence (columns may already exist from your presence migration)
  await query(
    `UPDATE crew
        SET active = TRUE,
            on_duty = TRUE,
            busy = FALSE,
            deck_zone = 'Bridge'
      WHERE id = $1`,
    [crewId]
  );
});

test('POST /api/triage/visits admits a crew member (under_treatment)', async () => {
  const res = await request(app)
    .post('/api/triage/visits')
    .send({ crewId, state: 'under_treatment', acuity: 3, complaint: 'demo', bed: 'Bed 1' });

  // Created
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty('id');
  visitId = res.body.id;

  // Event log should contain initial state as first event
  const ev1 = await getEventsForVisit(visitId);
  expect(ev1.length).toBeGreaterThanOrEqual(1);
  expect(ev1[0].kind).toBe('under_treatment');

  // Presence should reflect OFF-duty + Sickbay (effective)
  const p = await request(app).get('/api/crew/presence');
  expect(p.status).toBe(200);

  const row = p.body.find(r => r.crewId === crewId);
  expect(row).toBeTruthy();

  // NEW expectations with the inTreatment model
  expect(row.inTreatment).toBe(true);      // patient flag set
  expect(row.onDuty).toBe(false);          // patients are never on duty
  expect(row.busy).toBe(false);            // patients are never counted as "busy (working)"
  expect(row.deck_zone).toBe('Sickbay');   // effective location
});

test('GET /api/triage/visits lists the active visit', async () => {
  const res = await request(app).get('/api/triage/visits');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);

  const v = res.body.find(v => v.id === visitId || v.crew_id === crewId);
  expect(v).toBeTruthy();
  expect(v.state).toMatch(/under_treatment|admitted/);
  expect(v.crew_name).toBeDefined(); // joined name
  expect(v.ended_at).toBeNull();     // still active
});

test('PATCH /api/triage/visits/:id -> recovering returns presence to ON duty (effective)', async () => {
  // Move to recovering (not counted as "active treatment" by presence rule)
  const upd = await request(app)
    .patch(`/api/triage/visits/${visitId}`)
    .send({ state: 'recovering' });
  expect(upd.status).toBe(200);
  expect(upd.body).toHaveProperty('ok', true);

   // Event log should include the 'recovering' event appended
  const ev2 = await getEventsForVisit(visitId);
  expect(ev2.map(e => e.kind)).toContain('recovering');

  // Idempotency: sending the same state again should NOT create a duplicate event
  const beforeCount = ev2.filter(e => e.kind === 'recovering').length;
  const upd2 = await request(app)
    .patch(`/api/triage/visits/${visitId}`)
    .send({ state: 'recovering' }); // same state
  expect(upd2.status).toBe(200);

  const ev3 = await getEventsForVisit(visitId);
  const afterCount = ev3.filter(e => e.kind === 'recovering').length;
  expect(afterCount).toBe(beforeCount); // no duplicate

  // Presence should revert to raw crew state (on_duty TRUE, busy FALSE, zone Bridge)
  const p = await request(app).get('/api/crew/presence');
  expect(p.status).toBe(200);
  const row = p.body.find(r => r.crewId === crewId);
  expect(row).toBeTruthy();
  expect(row.onDuty).toBe(true);
  expect(row.busy).toBe(false);
  expect(row.deck_zone).toBe('Bridge');
});

test('PATCH /api/triage/visits/:id discharge removes from active list and keeps presence ON', async () => {
  const upd = await request(app)
    .patch(`/api/triage/visits/${visitId}`)
    .send({ state: 'discharged', discharge: true });
  expect(upd.status).toBe(200);
  expect(upd.body).toHaveProperty('ok', true);

  // No longer in active list
  const list = await request(app).get('/api/triage/visits');
  expect(list.status).toBe(200);
  const stillThere = list.body.find(v => v.id === visitId);
  expect(stillThere).toBeFalsy();

  // Presence remains ON (baseline state)
  const p = await request(app).get('/api/crew/presence');
  const row = p.body.find(r => r.crewId === crewId);
  expect(row).toBeTruthy();
  expect(row.onDuty).toBe(true);
  expect(row.deck_zone).toBe('Bridge');

    // Visit should have ended_at set
  const vrow = await getVisitRow(visitId);
  expect(vrow).toBeTruthy();
  expect(vrow.ended_at).not.toBeNull();

  // Event log includes 'discharged' exactly once
  const ev4 = await getEventsForVisit(visitId);
  expect(ev4.map(e => e.kind)).toContain('discharged');
  const dischargedCount = ev4.filter(e => e.kind === 'discharged').length;
  expect(dischargedCount).toBe(1);
});

test('GET /api/triage/crew/:id/visits returns state_path and timestamps', async () => {
  const res = await request(app).get(`/api/triage/crew/${crewId}/visits?limit=10`);
  expect(res.status).toBe(200);
  expect(res.body).toBeTruthy();

  // If your handler returns { items, nextCursor }, adjust accordingly:
  const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
  expect(Array.isArray(items)).toBe(true);

  const mine = items.find(x => x.id === visitId);
  expect(mine).toBeTruthy();
  expect(mine.started_at).toBeTruthy();
  expect(mine).toHaveProperty('state_path');
  expect(Array.isArray(mine.state_path)).toBe(true);
  // Should reflect at least the states we traversed
  expect(mine.state_path.join(',')).toMatch(/under_treatment/);
  expect(mine.state_path.join(',')).toMatch(/recovering/);
  expect(mine.state_path.join(',')).toMatch(/discharged/);
});

test('GET /api/triage/crew/:id/visits supports cursor pagination', async () => {
  // Seed a couple extra visits to ensure >2 rows exist
  for (let i = 0; i < 3; i++) {
    const r = await request(app)
      .post('/api/triage/visits')
      .send({ crewId, state: 'admitted', acuity: 2, complaint: `seed #${i}` });
    expect(r.status).toBe(201);
    // quick discharge to close them, ensures ordering by started_at works
    await request(app)
      .patch(`/api/triage/visits/${r.body.id}`)
      .send({ state: 'discharged', discharge: true });
  }

  // Page 1
  const page1 = await request(app).get(`/api/triage/crew/${crewId}/visits?limit=2`);
  expect(page1.status).toBe(200);
  const items1 = Array.isArray(page1.body) ? page1.body : page1.body.items;
  expect(items1.length).toBeLessThanOrEqual(2);

  const next1 = page1.body.nextCursor || null;
  if (!next1) {
    // if only 1 page, nothing else to test
    return;
  }

  // Page 2 using cursor
  const page2 = await request(app)
    .get(`/api/triage/crew/${crewId}/visits?limit=2&cursor_started_at=${encodeURIComponent(next1.cursor_started_at)}&cursor_id=${next1.cursor_id}`);
  expect(page2.status).toBe(200);
  const items2 = Array.isArray(page2.body) ? page2.body : page2.body.items;

  // No overlap between pages
  const ids1 = new Set(items1.map(i => i.id));
  items2.forEach(i => expect(ids1.has(i.id)).toBe(false));
});

