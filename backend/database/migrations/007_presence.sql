-- 002_presence.sql
-- Adds presence columns and an auto-updating timestamp trigger.

-- 1) Columns (safe to re-run)
ALTER TABLE crew
  ADD COLUMN IF NOT EXISTS on_duty  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS busy     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2) Trigger function to keep updated_at fresh on presence/location changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'crew_set_updated_at' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.crew_set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END$$;

-- 3) Trigger (fires only when presence/location columns change)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crew_updated_at'
  ) THEN
    CREATE TRIGGER trg_crew_updated_at
    BEFORE UPDATE OF on_duty, busy, deck_zone
    ON public.crew
    FOR EACH ROW
    EXECUTE FUNCTION public.crew_set_updated_at();
  END IF;
END$$;
