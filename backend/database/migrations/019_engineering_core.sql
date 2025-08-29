-- 019_engineering_core.sql
-- Core time-series metrics for ship engineering systems.

CREATE TABLE IF NOT EXISTS engineering_metric (
  id           BIGSERIAL PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  system       TEXT        NOT NULL,            -- e.g. 'warp_core', 'eps', 'sif', 'impulse', ...
  metric       TEXT        NOT NULL,            -- e.g. 'output_mw', 'stability', 'grid_load_pct'
  part         TEXT,                            -- optional dimension: 'A1' (EPS section), 'fore' (shield arc), etc.
  value_num    DOUBLE PRECISION,                -- numeric reading
  value_text   TEXT,                            -- textual reading (fallback)
  unit         TEXT,                            -- e.g. 'MW','%','K','°C'
  status       TEXT,                            -- 'ok' | 'warn' | 'critical' (free text; UI maps tones)
  meta         JSONB       NOT NULL DEFAULT '{}'::jsonb, -- arbitrary sensor metadata

  CONSTRAINT eng_metric_value_chk CHECK (value_num IS NOT NULL OR value_text IS NOT NULL)
);

-- Fast lookups by time and by (system,metric,part)
CREATE INDEX IF NOT EXISTS eng_metric_ts_idx              ON engineering_metric (ts DESC);
CREATE INDEX IF NOT EXISTS eng_metric_sys_metric_ts_idx   ON engineering_metric (system, metric, ts DESC);
CREATE INDEX IF NOT EXISTS eng_metric_sys_metric_part_ts_idx
  ON engineering_metric (system, metric, COALESCE(part,''), ts DESC);

-- NOTIFY trigger so the websocket bridge can push updates
CREATE OR REPLACE FUNCTION eng_metric_notify() RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  payload := json_build_object(
    'id', NEW.id,
    'ts', NEW.ts,
    'system', NEW.system,
    'metric', NEW.metric,
    'part', NEW.part,
    'value_num', NEW.value_num,
    'value_text', NEW.value_text,
    'unit', NEW.unit,
    'status', NEW.status
  );
  PERFORM pg_notify('engineering_metric_insert', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eng_metric_notify_trg ON engineering_metric;
CREATE TRIGGER eng_metric_notify_trg
AFTER INSERT ON engineering_metric
FOR EACH ROW EXECUTE FUNCTION eng_metric_notify();
