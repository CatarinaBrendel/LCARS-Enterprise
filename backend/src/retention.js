import { getClient } from '../database/db.js';

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 14);
const MIN_KEEP_PER_CREW_METRIC = Number(process.env.MIN_KEEP_PER_CREW_METRIC ?? 200);
const MIN_KEEP_PER_CREW_EVENT  = Number(process.env.MIN_KEEP_PER_CREW_EVENT  ?? 200);
const PRUNE_BATCH_LIMIT = Number(process.env.PRUNE_BATCH_LIMIT ?? 10_000);

export async function runRetentionOnce(log = console) {
  const client = await getClient();
  try {
    log.info?.('[retention] start');

    // Combined prune = age filter + floor of last N
    const m = await client.query(
      `SELECT public.prune_crew_metric_age_with_floor($1::int,$2::int,$3::int) AS deleted`,
      [RETENTION_DAYS, MIN_KEEP_PER_CREW_METRIC, PRUNE_BATCH_LIMIT]
    );

    const e = await client.query(
      `SELECT public.prune_crew_event_age_with_floor($1::int,$2::int,$3::int) AS deleted`,
      [RETENTION_DAYS, MIN_KEEP_PER_CREW_EVENT, PRUNE_BATCH_LIMIT]
    );

    log.info?.(`[retention] keep-last-N: crew_metric=${m.rows[0].deleted} crew_event=${e.rows[0].deleted}`);

    log.info?.('[retention] done');
  } finally {
    client.release();
  }
}
