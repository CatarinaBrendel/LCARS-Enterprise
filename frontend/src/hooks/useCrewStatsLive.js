import { useEffect, useState, useCallback } from "react";
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

  const onTelemetry = useCallback((evt) => {
    if (!evt?.crewId || !evt?.metric) return;
    if (!metrics.includes(evt.metric)) return;

    setRows(prev => {
      const map = new Map(prev.map(r => [r.crewId, { ...r }]));
      const cur = map.get(evt.crewId) || { crewId: evt.crewId, name: `#${evt.crewId}` };

      const key = evt.metric;
      const prevVal = typeof cur[key] === "number" ? cur[key] : null;
      const nextVal = evt.value;

      cur[key] = nextVal;
      cur.ts = evt.ts || cur.ts;

      // trend + “changed recently” timestamp
      let trend = "flat";
      if (prevVal != null && nextVal != null) {
        if (nextVal > prevVal) trend = "up";
        else if (nextVal < prevVal) trend = "down";
      }
      cur[`${key}_trend`] = trend;
      cur[`${key}_changed_at`] = Date.now();

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
