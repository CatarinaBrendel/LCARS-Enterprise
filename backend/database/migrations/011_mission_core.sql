-- 011_mission_core.sql

-- Mission “header”
CREATE TABLE IF NOT EXISTS mission (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL,                         -- e.g. "SURVEY-12A"
  stardate      NUMERIC(10,2),                         -- optional
  sector        TEXT,
  authority     TEXT,                                  -- e.g. "Starfleet Command"
  status        TEXT NOT NULL DEFAULT 'planned',       -- planned|in_progress|hold|completed|aborted
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mission_status_chk CHECK (status IN
    ('planned','in_progress','hold','completed','aborted'))
);

-- Objectives
CREATE TABLE IF NOT EXISTS mission_objective (
  id            BIGSERIAL PRIMARY KEY,
  mission_id    BIGINT NOT NULL REFERENCES mission(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  details       TEXT,
  state         TEXT NOT NULL DEFAULT 'not_started',   -- not_started|in_progress|blocked|done
  priority      INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mission_objective_state_chk CHECK (state IN
    ('not_started','in_progress','blocked','done'))
);

-- Teams
CREATE TABLE IF NOT EXISTS mission_team (
  id            BIGSERIAL PRIMARY KEY,
  mission_id    BIGINT NOT NULL REFERENCES mission(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                         -- "Team 1"
  lead_crew_id  BIGINT REFERENCES crew(id),
  notes         TEXT
);

-- Team membership (point‑in‑time)
CREATE TABLE IF NOT EXISTS mission_team_assignment (
  id            BIGSERIAL PRIMARY KEY,
  team_id       BIGINT NOT NULL REFERENCES mission_team(id) ON DELETE CASCADE,
  crew_id       BIGINT NOT NULL REFERENCES crew(id),
  role          TEXT,                                  -- "Science Officer"
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at       TIMESTAMPTZ
);

-- Event log (timeline)
CREATE TABLE IF NOT EXISTS mission_event (
  id            BIGSERIAL PRIMARY KEY,
  mission_id    BIGINT NOT NULL REFERENCES mission(id) ON DELETE CASCADE,
  at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind          TEXT NOT NULL,                         -- created|team_deployed|objective_state|hold|resume|completed|aborted|note
  payload       JSONB                                  -- flexible details
);
