import request from 'supertest';
import express from 'express';
import createCrewStatusRouter from '../src/routes/api/crew-status.js';
import { jest } from '@jest/globals';

function makeAppWithRepo(fakeRepo) {
  const app = express();
  app.use(express.json());
  app.use('/api/crew-status', createCrewStatusRouter({ repo: fakeRepo }));
  // simple error handler so we see 500s instead of crashes
  app.use((err, _req, res, _next) => {
    // console.error(err); // uncomment for debug
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
  });
  return app;
}

describe('Crew Status routes', () => {
  let repo, app;

  beforeEach(() => {
    repo = {
      list:   jest.fn(async () => ({ rows: [{ id:1, name:'Jean Luc Piccard', role:'Admin', status:'OK', last_seen:new Date().toISOString() }], page:1, pageSize:20, total:1 })),
      getById:jest.fn(async (id) => id === '1' ? { id:1, name:'Jean Luc Piccard', role:'Admin', status:'OK', last_seen:new Date().toISOString() } : null),
      upsert: jest.fn(async (payload) => ({ id:2, ...payload, last_seen:new Date().toISOString() })),
      patch:  jest.fn(async (id, partial) => id === '2' ? { id:2, name:'Chief OBrien', role:'Officer', status:partial.status ?? 'OK', last_seen:new Date().toISOString() } : null),
      remove: jest.fn(async (_id) => {}),
      summary:jest.fn(async () => ({ byRole:{ Admin:1, Officer:1, Crew:0 }, byStatus:{ OK:2, WARN:0 } })),
    };
    app = makeAppWithRepo(repo);
  });

  test('GET /api/crew-status → list', async () => {
    const res = await request(app).get('/api/crew-status');
    expect(res.status).toBe(200);
    expect(repo.list).toHaveBeenCalled();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBe(1);
  });

  test('POST /api/crew-status → upsert', async () => {
    const payload = { name:'Chief OBrien', role:'Officer', status:'OK' };
    const res = await request(app).post('/api/crew-status').send(payload);
    expect(res.status).toBe(201);
    expect(repo.upsert).toHaveBeenCalledWith(payload);
    expect(res.body).toHaveProperty('id', 2);
  });

  test('GET /api/crew-status/:id → get one', async () => {
    const ok = await request(app).get('/api/crew-status/1');
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Jean Luc Piccard');

    const nf = await request(app).get('/api/crew-status/999');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
  });

  test('PATCH /api/crew-status/:id → patch', async () => {
    const res = await request(app).patch('/api/crew-status/2').send({ status:'WARN' });
    expect(res.status).toBe(200);
    expect(repo.patch).toHaveBeenCalledWith('2', { status:'WARN' });
    expect(res.body.status).toBe('WARN');
  });

  test('GET /api/crew-status/summary → summary', async () => {
    const res = await request(app).get('/api/crew-status/summary');
    expect(res.status).toBe(200);
    expect(repo.summary).toHaveBeenCalled();
    expect(res.body.byRole.Admin).toBe(1);
  });
})