-- Age-based prune for any table with a ts column
CREATE OR REPLACE FUNCTION prune_by_age(_table regclass, _days int)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE deleted_count bigint;
BEGIN
  EXECUTE format(
    'DELETE FROM %s t WHERE t.ts < now() - (%L || '' days'')::interval',
    _table, _days
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN COALESCE(deleted_count, 0);
END $$;

-- Keep-last-N per (crew_id, metric_name) for crew_metric
CREATE OR REPLACE FUNCTION prune_keep_last_n_per_crew_metric(_n int, _batch int DEFAULT 5000)
RETURNS bigint
LANGUAGE sql AS $$
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY crew_id, metric_name ORDER BY ts DESC) AS rn
  FROM crew_metric
),
doomed AS (
  SELECT id FROM ranked WHERE rn > _n LIMIT _batch
)
DELETE FROM crew_metric t USING doomed d
WHERE t.id = d.id
RETURNING 1;
$$;

-- Keep-last-N per crew for crew_event
CREATE OR REPLACE FUNCTION prune_keep_last_n_per_crew_event(_n int, _batch int DEFAULT 5000)
RETURNS bigint
LANGUAGE sql AS $$
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY crew_id ORDER BY ts DESC) AS rn
  FROM crew_event
),
doomed AS (
  SELECT id FROM ranked WHERE rn > _n LIMIT _batch
)
DELETE FROM crew_event t USING doomed d
WHERE t.id = d.id
RETURNING 1;
$$;



-- Safety: indexes (no-ops if they exist)
CREATE INDEX IF NOT EXISTS idx_crew_metric_ts_desc ON crew_metric (ts DESC);
CREATE INDEX IF NOT EXISTS idx_crew_metric_cmt     ON crew_metric (crew_id, metric_name, ts DESC);

CREATE INDEX IF NOT EXISTS idx_crew_event_ts_desc  ON crew_event  (ts DESC);
CREATE INDEX IF NOT EXISTS idx_crew_event_ct       ON crew_event  (crew_id, ts DESC);
