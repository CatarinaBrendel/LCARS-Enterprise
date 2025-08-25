-- 013_mission_seed_dev.sql  (psql-free)

DO $$
DECLARE
  mid  BIGINT;
  t1   BIGINT;
  t2   BIGINT;
BEGIN
  -- Mission
  INSERT INTO mission (code, stardate, sector, authority, status, started_at)
  VALUES ('SURVEY-12A', 8472.5, 'Gamma Quadrant / Karemma Trade Route',
          'Starfleet Command', 'in_progress', NOW())
  RETURNING id INTO mid;

  -- Objectives
  INSERT INTO mission_objective (mission_id, title, details, state, priority) VALUES
    (mid, 'Map subspace anomalies',       'Sweep sector grid A-D',              'in_progress', 100),
    (mid, 'Collect spectrographic samples','Focus on Class-M planetoids',       'not_started', 80),
    (mid, 'Establish comms relay',        'Temporary buoy chain',               'blocked',     60);

  -- Teams (insert separately so we can capture both IDs)
  INSERT INTO mission_team (mission_id, name, notes)
  VALUES (mid, 'Team 1', 'Away team alpha')
  RETURNING id INTO t1;

  INSERT INTO mission_team (mission_id, name, notes)
  VALUES (mid, 'Team 2', 'Engineering support')
  RETURNING id INTO t2;

  -- Assign one available crew member as Lead on Team 1 (if any crew exist)
  INSERT INTO mission_team_assignment (team_id, crew_id, role)
  SELECT t1, c.id, 'Lead'
  FROM (SELECT id FROM crew ORDER BY id ASC LIMIT 1) AS c
  ON CONFLICT DO NOTHING;

  -- Seed a couple of timeline events
  INSERT INTO mission_event (mission_id, kind, payload)
  VALUES
    (mid, 'created',       '{"by":"Captain"}'),
    (mid, 'team_deployed', jsonb_build_object('team', 'Team 1'));
END $$;
