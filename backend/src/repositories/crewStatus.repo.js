import { query } from '../../database/db.js';

// List with optional filters/pagination/sorting
export async function list({ role, status, q, sort, page, pageSize } = {}) {
  const clauses = [];
  const params = [];

  if (role)   { params.push(role);   clauses.push(`role = $${params.length}`); }
  if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
  if (q)      { params.push(`%${q}%`); clauses.push(`name ILIKE $${params.length}`); }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  // sort: "last_seen:desc"
  const [sortField = 'last_seen', dir = 'desc'] = (sort || 'last_seen:desc').split(':');
  const safeField = ['id','name','role','status','last_seen'].includes(sortField) ? sortField : 'last_seen';
  const safeDir = dir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const limit = Math.max(1, Math.min(parseInt(pageSize || '20', 10), 100));
  const pageNum = Math.max(1, parseInt(page || '1', 10));
  const offset = (pageNum - 1) * limit;

  const sql = `
    SELECT id, name, role, status, last_seen
    FROM crew_status
    ${where}
    ORDER BY ${safeField} ${safeDir}
    LIMIT ${limit} OFFSET ${offset};
  `;
  const countSql = `SELECT COUNT(*)::int AS total FROM crew_status ${where};`;

  const [rowsRes, countRes] = await Promise.all([
    query(sql, params),
    query(countSql, params),
  ]);

  return {
    rows: rowsRes.rows,
    page: pageNum,
    pageSize: limit,
    total: countRes.rows[0].total,
  };
}

export async function getById(id) {
  const resp = await query(
    `SELECT id, name, role, status, last_seen
     FROM crew_status
     WHERE id = $1`,
    [id]
  );
  return resp.rows[0] || null;
}

// Upsert by unique name
export async function upsert({ name, role = 'Crew', status = 'OK' } = {}) {
  if (!name) throw new Error('name is required');
  const resp = await query(
    `INSERT INTO crew_status (name, role, status)
     VALUES ($1,$2,$3)
     ON CONFLICT (name)
       DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, last_seen = now()
     RETURNING id, name, role, status, last_seen`,
    [name, role, status]
  );
  return resp.rows[0];
}

export async function patch(id, fields = {}) {
  const allowed = ['name','role','status'];
  const sets = [];
  const params = [];

  for (const k of allowed) {
    if (fields[k] !== undefined) {
      params.push(fields[k]);
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (!sets.length) return getById(id);

  params.push(id);
  const resp = await query(
    `UPDATE crew_status
       SET ${sets.join(', ')}, last_seen = now()
     WHERE id = $${params.length}
     RETURNING id, name, role, status, last_seen`,
    params
  );
  return resp.rows[0] || null;
}

export async function remove(id) {
  await query(`DELETE FROM crew_status WHERE id = $1`, [id]);
}

export async function summary() {
  const byRole   = await query(`SELECT role, COUNT(*)::int AS n FROM crew_status GROUP BY role`);
  const byStatus = await query(`SELECT status, COUNT(*)::int AS n FROM crew_status GROUP BY status`);
  return {
    byRole: Object.fromEntries(byRole.rows.map(r => [r.role, r.n])),
    byStatus: Object.fromEntries(byStatus.rows.map(r => [r.status, r.n])),
  };
}
