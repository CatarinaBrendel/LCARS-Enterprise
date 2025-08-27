DO $$
DECLARE
  mid  BIGINT;
  t1   BIGINT;
  t2   BIGINT;
BEGIN
  -- Upsert mission, get its id no matter if inserted or updated
  WITH upsert AS (
    INSERT INTO mission (code, stardate, sector, authority, status, started_at, updated_at)
    VALUES (
      'SURVEY-12A',
      8472.5,
      'Gamma Quadrant / Karemma Trade Route',
      'Starfleet Command',
      'in_progress',
      NOW(),
      NOW()
    )
    ON CONFLICT (code) DO UPDATE
      SET stardate   = EXCLUDED.stardate,
          sector     = EXCLUDED.sector,
          authority  = EXCLUDED.authority,
          status     = EXCLUDED.status,
          -- keep existing started_at if present; otherwise set it
          started_at = COALESCE(mission.started_at, EXCLUDED.started_at),
          updated_at = NOW()
    RETURNING id
  )
  SELECT id INTO mid FROM upsert;

  -- Defensive: if upsert returned nothing (shouldn’t), fetch id
  IF mid IS NULL THEN
    SELECT id INTO mid FROM mission WHERE code = 'SURVEY-12A';
  END IF;

  -- Objectives (only insert missing; requires UNIQUE (mission_id, title) or will always insert)
  INSERT INTO mission_objective (mission_id, title, details, state, priority)
  VALUES
    (mid, 'Map subspace anomalies',        'Sweep sector grid A-D',        'in_progress', 100),
    (mid, 'Collect spectrographic samples','Focus on Class-M planetoids',  'not_started',  80),
    (mid, 'Establish comms relay',         'Temporary buoy chain',         'blocked',      60)
  ON CONFLICT (mission_id, title) DO NOTHING;

  -- Teams (requires UNIQUE (mission_id, name))
  INSERT INTO mission_team (mission_id, name, notes)
  VALUES (mid, 'Team 1', 'Away team alpha')
  ON CONFLICT (mission_id, name) DO NOTHING
  RETURNING id INTO t1;

  IF t1 IS NULL THEN
    SELECT id INTO t1 FROM mission_team WHERE mission_id = mid AND name = 'Team 1';
  END IF;

  INSERT INTO mission_team (mission_id, name, notes)
  VALUES (mid, 'Team 2', 'Engineering support')
  ON CONFLICT (mission_id, name) DO NOTHING
  RETURNING id INTO t2;

  IF t2 IS NULL THEN
    SELECT id INTO t2 FROM mission_team WHERE mission_id = mid AND name = 'Team 2';
  END IF;

  -- Assign one available crew member as Lead on Team 1 (unique on team_id, crew_id)
  INSERT INTO mission_team_assignment (team_id, crew_id, role)
  SELECT t1, c.id, 'Lead'
  FROM (SELECT id FROM crew ORDER BY id ASC LIMIT 1) AS c
  ON CONFLICT (team_id, crew_id) DO NOTHING;

  -- Seed timeline events once (you can make (mission_id, kind, payload) unique, or be lenient)
  INSERT INTO mission_event (mission_id, kind, payload)
  VALUES
    (mid, 'created',       '{"by":"Captain"}'),
    (mid, 'team_deployed', jsonb_build_object('team', 'Team 1'))
  ON CONFLICT DO NOTHING;
END $$;
