-- 012_mission_progress_pct.sql

-- 1) Add progress_pct used by simulator/generator
ALTER TABLE mission
  ADD COLUMN IF NOT EXISTS progress_pct integer NOT NULL DEFAULT 0;

-- 2) (Optional) If your code inserts created_at, add it safely
ALTER TABLE mission
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW();

ALTER TABLE mission_objective
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW();

-- 3) Backfill progress_pct from objectives so existing rows aren’t all 0
WITH agg AS (
  SELECT mission_id,
         ROUND(
           100 * SUM(CASE state
                       WHEN 'done' THEN 1.0
                       WHEN 'in_progress' THEN 0.5
                       ELSE 0.0
                     END) / NULLIF(COUNT(*), 0)
         )::int AS pct
  FROM mission_objective
  GROUP BY mission_id
)
UPDATE mission m
SET progress_pct = COALESCE(agg.pct, 0),
    updated_at   = NOW()
FROM agg
WHERE agg.mission_id = m.id;
