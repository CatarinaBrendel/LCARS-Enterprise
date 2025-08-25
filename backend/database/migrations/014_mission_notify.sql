-- 014_mission_notify.sql

-- Channel name we’ll LISTEN to from Node:
--   rt_mission

CREATE OR REPLACE FUNCTION notify_mission_event() RETURNS trigger AS $$
DECLARE
  payload_json jsonb;
BEGIN
  payload_json := jsonb_build_object(
    'type',   'event',
    'mission_id', NEW.mission_id,
    'event_id', NEW.id,
    'kind',   NEW.kind,
    'at',     NEW.at
  );
  PERFORM pg_notify('rt_mission', payload_json::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_mission_event ON mission_event;
CREATE TRIGGER trg_notify_mission_event
AFTER INSERT ON mission_event
FOR EACH ROW EXECUTE FUNCTION notify_mission_event();

CREATE OR REPLACE FUNCTION notify_mission_status() RETURNS trigger AS $$
DECLARE
  payload_json jsonb;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
      payload_json := jsonb_build_object(
        'type', 'status',
        'mission_id', NEW.id,
        'status', NEW.status
      );
      PERFORM pg_notify('rt_mission', payload_json::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_mission_status ON mission;
CREATE TRIGGER trg_notify_mission_status
AFTER UPDATE ON mission
FOR EACH ROW EXECUTE FUNCTION notify_mission_status();

CREATE OR REPLACE FUNCTION notify_mission_objective() RETURNS trigger AS $$
DECLARE
  payload_json jsonb;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.state IS DISTINCT FROM OLD.state
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
      payload_json := jsonb_build_object(
        'type', 'objective',
        'mission_id', NEW.mission_id,
        'objective_id', NEW.id,
        'state', NEW.state
      );
      PERFORM pg_notify('rt_mission', payload_json::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_mission_objective ON mission_objective;
CREATE TRIGGER trg_notify_mission_objective
AFTER UPDATE ON mission_objective
FOR EACH ROW EXECUTE FUNCTION notify_mission_objective();
