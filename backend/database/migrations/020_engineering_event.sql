-- 020_engineering_event.sql
-- Discrete incidents / automations (for the Events panel and audits).

CREATE TABLE IF NOT EXISTS engineering_event (
  id        BIGSERIAL PRIMARY KEY,
  ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  system    TEXT        NOT NULL,       -- 'eps','shields','warp_core','life_support','impulse','transporter','consumables'
  severity  TEXT        NOT NULL,       -- 'info','warn','critical'
  message   TEXT        NOT NULL,
  context   JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS eng_event_ts_idx          ON engineering_event (ts DESC);
CREATE INDEX IF NOT EXISTS eng_event_system_ts_idx   ON engineering_event (system, ts DESC);
CREATE INDEX IF NOT EXISTS eng_event_severity_ts_idx ON engineering_event (severity, ts DESC);

-- NOTIFY trigger for event stream
CREATE OR REPLACE FUNCTION eng_event_notify() RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  payload := json_build_object(
    'id', NEW.id,
    'ts', NEW.ts,
    'system', NEW.system,
    'severity', NEW.severity,
    'message', NEW.message
  );
  PERFORM pg_notify('engineering_event_insert', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eng_event_notify_trg ON engineering_event;
CREATE TRIGGER eng_event_notify_trg
AFTER INSERT ON engineering_event
FOR EACH ROW EXECUTE FUNCTION eng_event_notify();
