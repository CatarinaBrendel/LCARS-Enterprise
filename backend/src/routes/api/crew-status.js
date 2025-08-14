// GET /crew-status
    // Filters: role=Admin|Officer|Crew, status=OK|WARN|..., q=name-substring
    // Pagination: page, pageSize (defaults)
    // Sorting: sort=last_seen:desc (field:direction)
    // Returns: { data: Row[], meta: { page, pageSize, total } }
// POST /crew-status (idempotent upsert on name)
// GET /crew-status/:id
// PATCH /crew-status/:id (partial update)
// DELETE /crew-status/:id
// POST /crew-status/bulk (array of rows to upsert)
// GET /crew-status/summary → counts by role/status for dashboards
    // byRole: { Admin: n, Officer: n, Crew: n }, 
    // byStatus: { OK: n, WARN: n, ... }

import { Router } from 'express';

/**
 * @param {{ repo: {
 *   list: Function, getById: Function, upsert: Function,
 *   patch: Function, remove: Function, summary: Function
 * }}} deps
 */
export default function createCrewStatusRouter({ repo }) {
  const route = Router();

  route.get('/', async (req, res, next) => {
    try {
      const { rows, page, pageSize, total } = await repo.list(req.query);
      res.json({ data: rows, meta: { page, pageSize, total } });
    } catch (e) { next(e); }
  });

  route.get('/summary', async (_req, res, next) => {
    try { res.json(await repo.summary()); } catch (e) { next(e); }
  });

  route.get('/:id', async (req, res, next) => {
    try {
      const row = await repo.getById(req.params.id);
      if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'crew_status not found' } });
      res.json(row);
    } catch (e) { next(e); }
  });

  route.post('/', async (req, res, next) => {
    try {
      const row = await repo.upsert(req.body);
      res.status(201).json(row);
    } catch (e) { next(e); }
  });

  route.patch('/:id', async (req, res, next) => {
    try {
      const row = await repo.patch(req.params.id, req.body);
      if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'crew_status not found' } });
      res.json(row);
    } catch (e) { next(e); }
  });

  route.delete('/:id', async (req, res, next) => {
    try { await repo.remove(req.params.id); res.status(204).end(); } catch (e) { next(e); }
  });

  return route;
}
