-- Triage / Treatment episodes
CREATE TABLE IF NOT EXISTS triage_visit (
  id           BIGSERIAL PRIMARY KEY,
  crew_id      INT NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
  state        TEXT NOT NULL CHECK (state IN ('queued','triage','admitted','under_treatment','recovering','discharged')),
  acuity       INT CHECK (acuity BETWEEN 1 AND 5),
  complaint    TEXT,
  assigned_to  TEXT,
  bed          TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_triage_visit_crew ON triage_visit(crew_id);
CREATE INDEX IF NOT EXISTS idx_triage_visit_active
  ON triage_visit(crew_id) WHERE ended_at IS NULL AND state IN ('admitted','under_treatment');

-- Touch trigger
CREATE OR REPLACE FUNCTION triage_visit_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_triage_visit_touch ON triage_visit;
CREATE TRIGGER trg_triage_visit_touch BEFORE UPDATE ON triage_visit
FOR EACH ROW EXECUTE FUNCTION triage_visit_touch();

-- Presence NOTIFY (for WS fanout)
CREATE OR REPLACE FUNCTION triage_visit_notify_presence() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('triage_presence', json_build_object('crewId', NEW.crew_id)::text);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_triage_visit_notify ON triage_visit;
CREATE TRIGGER trg_triage_visit_notify
AFTER INSERT OR UPDATE OF state, ended_at ON triage_visit
FOR EACH ROW EXECUTE FUNCTION triage_visit_notify_presence();

-- Optional: a broader triage change channel (for triage UI)
CREATE OR REPLACE FUNCTION triage_visit_notify_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'triage_change',
    json_build_object(
      'id', NEW.id, 'crewId', NEW.crew_id, 'state', NEW.state,
      'acuity', NEW.acuity, 'bed', NEW.bed, 'ended_at', NEW.ended_at
    )::text
  );
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_triage_visit_change ON triage_visit;
CREATE TRIGGER trg_triage_visit_change
AFTER INSERT OR UPDATE ON triage_visit
FOR EACH ROW EXECUTE FUNCTION triage_visit_notify_change();
