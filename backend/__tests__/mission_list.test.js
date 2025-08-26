// backend/__tests__/mission_list.test.js
import request from 'supertest';
import app from '../src/app.js';
import { query } from '../database/db.js';

const SEED = [
  // code,        status(DB),     sector,  authority, progress_pct
  ['LIST-ALPHA',  'planned',      'Alpha', 'Starfleet Ops',     40],
  ['LIST-BETA',   'in_progress',  'Beta',  'USS Voyager',       80],
  ['LIST-GAMMA',  'completed',    'Gamma', 'Federation Science', 0],
];

const OBJ_TITLE_MATCH = 'Dilithium Calibration Protocol'; // for q= search
const codes = SEED.map(s => s[0]);
let ids = [];

beforeAll(async () => {
  await query(`DELETE FROM mission WHERE code LIKE 'LIST-%'`);

  // Insert 3 missions with different statuses/sectors/progress
  for (const [code, status, sector, authority, progress] of SEED) {
    const m = await query(
      `INSERT INTO mission (code, stardate, sector, authority, status, started_at, updated_at)
       VALUES ($1, 9701.5, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [code, sector, authority, status]
    );
    const id = m.rows[0].id;
    ids.push(id);

    // One mission gets an objective with a searchable title
    if (code === 'LIST-BETA') {
      await query(
        `INSERT INTO mission_objective (mission_id, title, details, state, priority)
         VALUES ($1, $2, 'seed', 'in_progress', 100)`,
        [id, OBJ_TITLE_MATCH]
      );
    }

    await query(
      `INSERT INTO mission_event (mission_id, kind, payload)
       VALUES ($1, 'created', '{"seedList":true}')`,
      [id]
    );
  }
});

afterAll(async () => {
  // cleanup the exact rows we created
  await query(`DELETE FROM mission_event     WHERE mission_id = ANY($1)`, [ids]);
  await query(`DELETE FROM mission_objective WHERE mission_id = ANY($1)`, [ids]);
  await query(`DELETE FROM mission           WHERE id         = ANY($1)`, [ids]);
});

function byCode(items) {
  return items.sort((a, b) => a.code.localeCompare(b.code));
}

test('GET /api/missions filters by status (UI labels) and scopes by q=LIST-', async () => {
  const res = await request(app)
    .get('/api/missions')
    .query({
      status: 'IN PROGRESS,DONE', // UI labels
      q: 'LIST-'                  // limit to our seed
    });

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.items)).toBe(true);

  const items = res.body.items;
  // Only our beta (in_progress → IN PROGRESS) and gamma (completed → DONE) should appear
  const codesReturned = items.map(i => i.code);
  expect(codesReturned).toEqual(expect.arrayContaining(['LIST-BETA', 'LIST-GAMMA']));
  expect(codesReturned).not.toContain('LIST-ALPHA');

  // Status mapping present (UI labels)
  const statusSet = new Set(items.map(i => i.status));
  expect(statusSet.has('IN PROGRESS')).toBe(true);
  expect(statusSet.has('DONE')).toBe(true);
});

test('GET /api/missions supports sorting (code asc) within q=LIST-', async () => {
  const res = await request(app)
    .get('/api/missions')
    .query({
      q: 'LIST-',
      sortBy: 'code',
      sortDir: 'asc'
    });

  expect(res.status).toBe(200);
  const items = res.body.items;
  const sorted = byCode([...items]);
  expect(items.map(i => i.code)).toEqual(sorted.map(i => i.code));
});

test('GET /api/missions supports pagination', async () => {
  const res1 = await request(app)
    .get('/api/missions')
    .query({ q: 'LIST-', page: 1, pageSize: 1, sortBy: 'code', sortDir: 'asc' });

  const res2 = await request(app)
    .get('/api/missions')
    .query({ q: 'LIST-', page: 2, pageSize: 1, sortBy: 'code', sortDir: 'asc' });

  expect(res1.status).toBe(200);
  expect(res2.status).toBe(200);

  expect(res1.body.items).toHaveLength(1);
  expect(res2.body.items).toHaveLength(1);

  // total should reflect all our LIST-* missions (3 or more if others also match LIST-)
  expect(Number(res1.body.total)).toBeGreaterThanOrEqual(3);
  expect(Number(res2.body.total)).toBeGreaterThanOrEqual(3);

  // page 1 and page 2 should be different items (under stable sort)
  expect(res1.body.items[0].code).not.toBe(res2.body.items[0].code);
});

test('GET /api/missions can filter by sector=Beta', async () => {
  const res = await request(app)
    .get('/api/missions')
    .query({ q: 'LIST-', sector: 'Beta' });

  expect(res.status).toBe(200);
  expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  for (const it of res.body.items) {
    expect(it.sector).toBe('Beta');
  }
});

test('GET /api/missions supports search (q) hitting objective titles via EXISTS', async () => {
  const res = await request(app)
    .get('/api/missions')
    .query({ q: 'Calibration' }); // substring from OBJ_TITLE_MATCH

  expect(res.status).toBe(200);
  const codesFound = res.body.items.map(i => i.code);
  // Should at least include the mission where we added that objective
  expect(codesFound).toContain('LIST-BETA');
});

test('GET /api/missions exposes progress as integer % in [0,100]', async () => {
  const res = await request(app)
    .get('/api/missions')
    .query({ q: 'LIST-' });

  expect(res.status).toBe(200);
  for (const it of res.body.items) {
    expect(Number.isInteger(it.progress)).toBe(true);
    expect(it.progress).toBeGreaterThanOrEqual(0);
    expect(it.progress).toBeLessThanOrEqual(100);
  }
});

test('GET /api/missions/sectors returns distinct sectors including our seeded ones', async () => {
  const res = await request(app).get('/api/missions/sectors');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('items');
  const sectors = res.body.items.map(x => x.sector);

  // Our sectors should be present (counts may be >= our seed due to other data)
  expect(sectors).toEqual(expect.arrayContaining(['Alpha', 'Beta', 'Gamma']));

  // Optional: ensure shape includes counts as integers
  for (const row of res.body.items) {
    expect(typeof row.sector).toBe('string');
    expect(Number.isInteger(row.count)).toBe(true);
  }
});
