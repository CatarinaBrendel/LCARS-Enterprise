-- backend/database/migrations/005_retention_fix.sql
SET search_path = public;

-- Ensure no stale variants remain
DROP FUNCTION IF EXISTS public.prune_crew_metric_age_with_floor(int,int,int);
DROP FUNCTION IF EXISTS public.prune_crew_event_age_with_floor(int,int,int);

-- Delete only rows older than cutoff that are also beyond the latest N per (crew, metric)
CREATE OR REPLACE FUNCTION public.prune_crew_metric_age_with_floor(_days int, _n int, _batch int DEFAULT 5000)
RETURNS bigint
LANGUAGE sql AS $$
WITH ranked AS (
  SELECT id, ts,
         row_number() OVER (PARTITION BY crew_id, metric_name ORDER BY ts DESC) AS rn
  FROM public.crew_metric
),
doomed AS (
  SELECT r.id
  FROM ranked r
  WHERE r.rn > _n
    AND r.ts < now() - (_days || ' days')::interval
  LIMIT _batch
)
DELETE FROM public.crew_metric t
USING doomed d
WHERE t.id = d.id
RETURNING 1;
$$;

-- Delete only rows older than cutoff that are also beyond the latest N per crew
CREATE OR REPLACE FUNCTION public.prune_crew_event_age_with_floor(_days int, _n int, _batch int DEFAULT 5000)
RETURNS bigint
LANGUAGE sql AS $$
WITH ranked AS (
  SELECT id, ts,
         row_number() OVER (PARTITION BY crew_id ORDER BY ts DESC) AS rn
  FROM public.crew_event
),
doomed AS (
  SELECT r.id
  FROM ranked r
  WHERE r.rn > _n
    AND r.ts < now() - (_days || ' days')::interval
  LIMIT _batch
)
DELETE FROM public.crew_event t
USING doomed d
WHERE t.id = d.id
RETURNING 1;
$$;
