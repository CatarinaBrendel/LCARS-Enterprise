-- 010_presence_guard.sql
-- Goal:
--  1) Only one active (ended_at IS NULL) triage_visit per crew.
--  2) Faster presence lookups for Med Bay overrides.
-- Policy A: treat ('admitted','under_treatment','triage','recovering') as Med Bay.

BEGIN;

-- 0) Clean up any existing duplicates so the unique index can be created.
--    Keep the most recent active visit per crew; close the rest as discharged.
WITH active AS (
  SELECT
    id, crew_id, state, started_at,
    ROW_NUMBER() OVER (PARTITION BY crew_id ORDER BY started_at DESC, id DESC) AS rn
  FROM triage_visit
  WHERE ended_at IS NULL
),
dupes AS (
  SELECT id FROM active WHERE rn > 1
)
UPDATE triage_visit v
SET state = 'discharged',
    ended_at = NOW()
WHERE v.id IN (SELECT id FROM dupes);

-- 1) Partial UNIQUE index: at most one active visit per crew.
--    (Note: If your migration runner wraps in a transaction, avoid CONCURRENTLY.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_visit_per_crew
  ON triage_visit (crew_id)
  WHERE ended_at IS NULL;

-- 2) Presence fast path: index exactly matches your presence filter.
--    This speeds up EXISTS (…) in /crew/presence.
CREATE INDEX IF NOT EXISTS triage_active_presence_idx
  ON triage_visit (crew_id)
  WHERE ended_at IS NULL
    AND state IN ('admitted','under_treatment','triage','recovering');

-- Optional: also helps time-ordered history queries of active rows
CREATE INDEX IF NOT EXISTS triage_active_started_idx
  ON triage_visit (crew_id, started_at DESC)
  WHERE ended_at IS NULL;

-- Optional safety: discharged rows must have ended_at
-- (skip if you already enforce this in app logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'triage_visit_discharge_has_ended_at'
  ) THEN
    ALTER TABLE triage_visit
      ADD CONSTRAINT triage_visit_discharge_has_ended_at
      CHECK (state <> 'discharged' OR ended_at IS NOT NULL);
  END IF;
END $$;

COMMIT;
