-- 013_mission_status_guards.sql
BEGIN;

CREATE OR REPLACE FUNCTION mission_status_guard()
RETURNS trigger AS $$
DECLARE
  old_status text := NEW.status;
BEGIN
  -- normalize synonyms if your API maps UI names -> DB names elsewhere
  -- (planned/in_progress/hold/completed/aborted are already DB-native)

  -- R1: completed is terminal
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    RAISE EXCEPTION 'Mission % is completed and cannot change status', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- R2: once you leave planned, you never return to planned
  IF TG_OP = 'UPDATE' AND NEW.status = 'planned' AND OLD.status <> 'planned' THEN
    RAISE EXCEPTION 'Mission % cannot be reset to planned once progressed', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Allowed transitions
  IF OLD.status = NEW.status THEN
    RETURN NEW; -- no-op change allowed
  END IF;

  IF OLD.status = 'planned' AND NEW.status IN ('in_progress','hold','aborted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'in_progress' AND NEW.status IN ('hold','completed','aborted') THEN
    RETURN NEW;
  ELSIF OLD.status = 'hold' AND NEW.status IN ('in_progress','aborted') THEN
    RETURN NEW;
  ELSIF OLD.status IN ('aborted') THEN
    RAISE EXCEPTION 'Mission % is aborted and cannot change status', OLD.id
      USING ERRCODE = 'check_violation';
  ELSE
    RAISE EXCEPTION 'Illegal mission status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mission_status_guard ON mission;
CREATE TRIGGER trg_mission_status_guard
BEFORE UPDATE OF status ON mission
FOR EACH ROW
EXECUTE FUNCTION mission_status_guard();

COMMIT;
