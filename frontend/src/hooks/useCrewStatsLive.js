import { useEffect, useMemo, useState, useCallback } from "react";
import { socket, subscribeTelemetry, unsubscribeTelemetry } from "../lib/ws";

/**
 * Expects a REST endpoint that returns one row per crew with latest vitals:
 * GET /api/crew_stats  ->  [{ crewId, name, heart_rate, o2_sat, temp_core, ts }]
 */
export default function useCrewStatsLive({ metrics = ["heart_rate","o2_sat","body_temp"] } = {}) {
  const [rows, setRows] = useState([]);    // [{ crewId, name, heart_rate, o2_sat, body_temp, ts }]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Seed from REST
  useEffect(() => {
    let alive = true;
    fetch("/api/crew/stats")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { if (alive) setRows(Array.isArray(data) ? data : (data.rows || [])); })
      .catch(e => { if (alive) setErr(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Index for quick updates
  const indexById = useMemo(() => {
    const m = new Map();
    for (const r of rows) m.set(r.crewId, r);
    return m;
  }, [rows]);

  // Socket handlers
  const onTelemetry = useCallback((evt) => {
    // evt: { crewId, metric, value, unit, ts }
    if (!evt?.crewId || !evt?.metric) return;
    if (!metrics.includes(evt.metric)) return;

    setRows(prev => {
      // copy map to avoid mutating
      const map = new Map();
      for (const r of prev) map.set(r.crewId, { ...r });

      const cur = map.get(evt.crewId) || { crewId: evt.crewId, name: `#${evt.crewId}` };
      cur[evt.metric] = evt.value;
      cur.ts = evt.ts || cur.ts;

      map.set(evt.crewId, cur);
      return Array.from(map.values()).sort((a, b) => a.crewId - b.crewId);
    });
  }, [metrics]);

  useEffect(() => {
    const onUpdate = (evt) => onTelemetry(evt);
    socket.on("telemetry:update", onUpdate);

    // subscribe to metrics globally (all crews)
    subscribeTelemetry({ crewId: null, metrics });

    return () => {
      socket.off("telemetry:update", onUpdate);
      unsubscribeTelemetry({ crewId: null, metrics });
    };
  }, [onTelemetry, metrics]);

  return { rows, loading, err };
}
