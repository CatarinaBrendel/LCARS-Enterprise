-- 021_engineering_views.sql
-- Latest-per-(system, metric, part) and a convenience snapshot view
-- the API can SELECT once to fill the Engineering tab.

-- Latest reading per (system,metric,part)
CREATE OR REPLACE VIEW v_engineering_latest_metrics AS
SELECT DISTINCT ON (system, metric, COALESCE(part,''))
  system,
  metric,
  part,
  value_num,
  value_text,
  unit,
  status,
  ts
FROM engineering_metric
ORDER BY system, metric, COALESCE(part,''), ts DESC;

-- Convenience: reshape latest metrics into a JSON object your frontend expects.
-- Keep it simple and predictable; API can SELECT this single row.
CREATE OR REPLACE VIEW v_engineering_snapshot AS
WITH L AS (
  SELECT * FROM v_engineering_latest_metrics
),
-- Helper to fetch a numeric latest value
num AS (
  SELECT system, metric, part, value_num
  FROM L
),
txt AS (
  SELECT system, metric, part, value_text
  FROM L
)
SELECT jsonb_build_object(
  'ts', NOW(),
  'warpCore', jsonb_build_object(
    'outputMW',      (SELECT value_num FROM num WHERE system='warp_core' AND metric='output_mw'      LIMIT 1),
    'maxOutputMW',   (SELECT value_num FROM num WHERE system='warp_core' AND metric='max_output_mw'  LIMIT 1),
    'stability',     (SELECT value_num FROM num WHERE system='warp_core' AND metric='stability'      LIMIT 1),
    'intermix',      (SELECT value_num FROM num WHERE system='warp_core' AND metric='intermix'       LIMIT 1),
    'plasmaTempK',   (SELECT value_num FROM num WHERE system='warp_core' AND metric='plasma_temp_k'  LIMIT 1),
    'latticeStress', (SELECT value_num FROM num WHERE system='warp_core' AND metric='lattice_stress' LIMIT 1)
  ),
  'eps', jsonb_build_object(
    'gridLoadPct', (SELECT value_num FROM num WHERE system='eps' AND metric='grid_load_pct'  LIMIT 1),
    'lineLossPct', (SELECT value_num FROM num WHERE system='eps' AND metric='line_loss_pct'  LIMIT 1),
    'tripsPerMin', (SELECT value_num FROM num WHERE system='eps' AND metric='trips_per_min'  LIMIT 1)
  ),
  'sif', jsonb_build_object(
    'strength',         (SELECT value_num FROM num WHERE system='sif' AND metric='strength'           LIMIT 1),
    'hullStressMpa',    (SELECT value_num FROM num WHERE system='sif' AND metric='hull_stress_mpa'    LIMIT 1),
    'emitterHealthPct', (SELECT value_num FROM num WHERE system='sif' AND metric='emitter_health_pct' LIMIT 1)
  ),
  'impulse', jsonb_build_object(
    'reactorPct',    (SELECT value_num FROM num WHERE system='impulse' AND metric='reactor_pct'    LIMIT 1),
    'thrustVector',  (SELECT value_num FROM num WHERE system='impulse' AND metric='thrust_vector'  LIMIT 1),
    'rcsFuelPct',    (SELECT value_num FROM num WHERE system='impulse' AND metric='rcs_fuel_pct'   LIMIT 1),
    'nozzleTempC',   (SELECT value_num FROM num WHERE system='impulse' AND metric='nozzle_temp_c'  LIMIT 1)
  ),
  'damage', jsonb_build_object(
    'activeFaults',  (SELECT value_num FROM num WHERE system='damage' AND metric='active_faults'   LIMIT 1),
    'openWorkOrders',(SELECT value_num FROM num WHERE system='damage' AND metric='open_work_orders'LIMIT 1),
    'teamsActive',   (SELECT value_num FROM num WHERE system='damage' AND metric='teams_active'    LIMIT 1),
    'etaMin',        (SELECT value_num FROM num WHERE system='damage' AND metric='eta_min'         LIMIT 1)
  )
) AS snapshot;
