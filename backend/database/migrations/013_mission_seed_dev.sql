
-- 013_mission_seed_dev.sql

-- Example mission
INSERT INTO mission (code, stardate, sector, authority, status, started_at)
VALUES ('SURVEY-12A', 8472.5, 'Gamma Quadrant / Karemma Trade Route', 'Starfleet Command', 'in_progress', NOW())
RETURNING id \gset

-- Objectives
INSERT INTO mission_objective (mission_id, title, details, state, priority) VALUES
  (:id, 'Map subspace anomalies', 'Sweep sector grid A‑D', 'in_progress', 100),
  (:id, 'Collect spectrographic samples', 'Focus on Class‑M planetoids', 'not_started', 80),
  (:id, 'Establish comms relay', 'Temporary buoy chain', 'blocked', 60);

-- Teams
INSERT INTO mission_team (mission_id, name, notes) VALUES
  (:id, 'Team 1', 'Away team alpha'),
  (:id, 'Team 2', 'Engineering support')
RETURNING id \gset

-- Assignments (attach some existing crew ids if you have them)
-- Example uses any two crew rows:
WITH picks AS (
  SELECT id FROM crew ORDER BY id ASC LIMIT 2
)
INSERT INTO mission_team_assignment (team_id, crew_id, role)
SELECT :id, id, 'Lead' FROM picks LIMIT 1;

INSERT INTO mission_event (mission_id, kind, payload)
VALUES
  (:id, 'created', '{"by":"Captain"}'::jsonb),
  (:id, 'team_deployed', '{"team":"Team 1"}'::jsonb);
