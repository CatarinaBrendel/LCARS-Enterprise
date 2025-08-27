-- 016_mission_add_constraint.sql
-- Idempotent adds: use existing index if present, else create constraint.

DO $$
BEGIN
  -- mission.code unique
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_code_unique'
      AND conrelid = 'mission'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mission_code_unique' AND relkind = 'i') THEN
      ALTER TABLE mission
        ADD CONSTRAINT mission_code_unique UNIQUE USING INDEX mission_code_unique;
    ELSE
      ALTER TABLE mission
        ADD CONSTRAINT mission_code_unique UNIQUE (code);
    END IF;
  END IF;

  -- mission_objective (mission_id, title)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_objective_unique'
      AND conrelid = 'mission_objective'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mission_objective_unique' AND relkind = 'i') THEN
      ALTER TABLE mission_objective
        ADD CONSTRAINT mission_objective_unique UNIQUE USING INDEX mission_objective_unique;
    ELSE
      ALTER TABLE mission_objective
        ADD CONSTRAINT mission_objective_unique UNIQUE (mission_id, title);
    END IF;
  END IF;

  -- mission_team (mission_id, name)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_team_unique'
      AND conrelid = 'mission_team'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mission_team_unique' AND relkind = 'i') THEN
      ALTER TABLE mission_team
        ADD CONSTRAINT mission_team_unique UNIQUE USING INDEX mission_team_unique;
    ELSE
      ALTER TABLE mission_team
        ADD CONSTRAINT mission_team_unique UNIQUE (mission_id, name);
    END IF;
  END IF;

  -- mission_team_assignment (team_id, crew_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mission_team_assignment_unique'
      AND conrelid = 'mission_team_assignment'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mission_team_assignment_unique' AND relkind = 'i') THEN
      ALTER TABLE mission_team_assignment
        ADD CONSTRAINT mission_team_assignment_unique UNIQUE USING INDEX mission_team_assignment_unique;
    ELSE
      ALTER TABLE mission_team_assignment
        ADD CONSTRAINT mission_team_assignment_unique UNIQUE (team_id, crew_id);
    END IF;
  END IF;
END $$;
