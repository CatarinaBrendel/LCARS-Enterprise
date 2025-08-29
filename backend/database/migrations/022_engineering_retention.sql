-- 022_engineering_retention.sql
-- Similar to your existing retention helpers for metrics/events.

CREATE OR REPLACE FUNCTION prune_engineering_metric_age_with_floor(
  _days  INT,         -- delete older than N days...
  _keep  INT,         -- ...but keep at least N newest rows
  _batch INT DEFAULT 5000
) RETURNS INT AS $$
DECLARE
  v_deleted INT := 0;
BEGIN
  WITH c AS (
    SELECT id
    FROM engineering_metric
    WHERE ts < NOW() - (_days || ' days')::interval
    ORDER BY ts ASC
    OFFSET GREATEST(0, (SELECT GREATEST(0, (SELECT COUNT(*) FROM engineering_metric) - _keep)))
    LIMIT _batch
  )
  DELETE FROM engineering_metric USING c WHERE engineering_metric.id = c.id
  RETURNING engineering_metric.id INTO v_deleted;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prune_engineering_event_age_with_floor(
  _days  INT,
  _keep  INT,
  _batch INT DEFAULT 5000
) RETURNS INT AS $$
DECLARE
  v_deleted INT := 0;
BEGIN
  WITH c AS (
    SELECT id
    FROM engineering_event
    WHERE ts < NOW() - (_days || ' days')::interval
    ORDER BY ts ASC
    OFFSET GREATEST(0, (SELECT GREATEST(0, (SELECT COUNT(*) FROM engineering_event) - _keep)))
    LIMIT _batch
  )
  DELETE FROM engineering_event USING c WHERE engineering_event.id = c.id
  RETURNING engineering_event.id INTO v_deleted;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;
