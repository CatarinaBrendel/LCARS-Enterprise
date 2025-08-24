CREATE TABLE IF NOT EXISTS triage_visit_event (
  id SERIAL PRIMARY KEY,
  visit_id INT NOT NULL REFERENCES triage_visit(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL
    CHECK (kind IN ('queued','triage','admitted','under_treatment','recovering','discharged')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS triage_visit_event_visit_at_idx ON triage_visit_event(visit_id, at);
