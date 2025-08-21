import { getClient } from '../database/db.js';
import { runRetentionOnce } from '../src/retention.js';

test('retention prunes by age and keeps a floor per (crew,metric)', async () => {
  const c = await getClient();
  try {
    const crewId =
      (await c.query('SELECT id FROM crew LIMIT 1')).rows[0]?.id ??
      (await c.query('INSERT INTO crew (name, role, deck_zone, active) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Test Crew', 'Ops', 'Cargo', true])).rows[0].id;

    await c.query('BEGIN');
    await c.query('TRUNCATE crew_metric, crew_event RESTART IDENTITY');

    // smaller seed -> faster
     await c.query(`
      INSERT INTO crew_metric (ts, crew_id, metric_name, value, text_value, unit)
      SELECT NOW() - (i || ' days')::interval, $1::int, 'heart_rate', (70 + i % 30)::double precision, NULL, 'bpm'
      FROM generate_series(1, 60) AS i
      UNION ALL
      SELECT NOW() - (i || ' days')::interval, $1::int, 'o2_sat', (96 + i % 3)::double precision, NULL, '%'
      FROM generate_series(1, 60) AS i
    `, [crewId]);

    await c.query('COMMIT');

    process.env.RETENTION_DAYS = '14';
    process.env.MIN_KEEP_PER_CREW_METRIC = '20';
    process.env.MIN_KEEP_PER_CREW_EVENT  = '10';

    const before = Number((await c.query('SELECT count(*) FROM crew_metric')).rows[0].count);

    await runRetentionOnce();

    const after = Number((await c.query('SELECT count(*) FROM crew_metric')).rows[0].count);
    const remainHr = Number((await c.query('SELECT count(*) FROM crew_metric WHERE crew_id=$1 AND metric_name=$2', [crewId, 'heart_rate'])).rows[0].count);
    const remainO2 = Number((await c.query('SELECT count(*) FROM crew_metric WHERE crew_id=$1 AND metric_name=$2', [crewId, 'o2_sat'])).rows[0].count);

    expect(remainHr).toBeGreaterThanOrEqual(20);
    expect(remainO2).toBeGreaterThanOrEqual(20);
    expect(after).toBeLessThanOrEqual(before);
  } finally {
    c.release();
  }
}, 20000);

