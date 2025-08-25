-- 012_mission_indexes.sql

-- Quick lookup
CREATE INDEX IF NOT EXISTS mission_status_idx
  ON mission (status);

CREATE INDEX IF NOT EXISTS mission_updated_idx
  ON mission (updated_at DESC);

CREATE INDEX IF NOT EXISTS mission_objective_mission_idx
  ON mission_objective (mission_id, priority DESC, id);

CREATE INDEX IF NOT EXISTS mission_team_mission_idx
  ON mission_team (mission_id);

CREATE INDEX IF NOT EXISTS mission_team_assignment_team_idx
  ON mission_team_assignment (team_id, left_at);

CREATE INDEX IF NOT EXISTS mission_team_assignment_crew_idx
  ON mission_team_assignment (crew_id, left_at);

-- Active membership uniqueness (one active row per (team, crew))
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_member_per_team
  ON mission_team_assignment (team_id, crew_id)
  WHERE left_at IS NULL;

-- Event timeline scans
CREATE INDEX IF NOT EXISTS mission_event_mission_at_idx
  ON mission_event (mission_id, at DESC);

-- Optional: progress view (simple % done by objectives)
CREATE OR REPLACE VIEW mission_progress AS
SELECT
  m.id AS mission_id,
  COALESCE(NULLIF(COUNT(o.id),0),1) AS total_objectives,
  SUM(CASE WHEN o.state = 'done' THEN 1 ELSE 0 END) AS done_objectives,
  ROUND(100.0 * SUM(CASE WHEN o.state='done' THEN 1 ELSE 0 END)
        / GREATEST(COUNT(o.id),1), 1) AS progress_pct
FROM mission m
LEFT JOIN mission_objective o ON o.mission_id = m.id
GROUP BY m.id;
