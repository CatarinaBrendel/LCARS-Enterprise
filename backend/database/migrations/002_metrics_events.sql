-- Time-series metrics (long form)
CREATE TABLE IF NOT EXISTS crew_metric (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  crew_id INT NOT NULL REFERENCES crew(id),
  metric_name TEXT NOT NULL,
  value DOUBLE PRECISION NULL,
  text_value TEXT NULL,
  unit TEXT NULL,
  CHECK ((value IS NOT NULL) <> (text_value IS NOT NULL))  -- exactly one set
);

CREATE INDEX IF NOT EXISTS idx_crew_metric_ts_desc ON crew_metric (ts DESC);
CREATE INDEX IF NOT EXISTS idx_crew_metric_cmt ON crew_metric (crew_id, metric_name, ts DESC);

-- Discrete events
CREATE TABLE IF NOT EXISTS crew_event (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  crew_id INT NOT NULL REFERENCES crew(id),
  event_type TEXT NOT NULL,
  severity INT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  details JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_crew_event_ts_desc ON crew_event (ts DESC);
CREATE INDEX IF NOT EXISTS idx_crew_event_ct ON crew_event (crew_id, ts DESC);
