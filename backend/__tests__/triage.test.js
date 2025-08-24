import request from 'supertest';
import app from '../src/app.js';
import { query } from '../database/db.js';

let crewId;
let visitId;
const name = 'Test Triage Crew';

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
});
