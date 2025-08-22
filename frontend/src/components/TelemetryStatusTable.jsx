import React, { useMemo } from "react";
import useTelemetryStream from "../hooks/useTelemetryStream";

// Utility: reduce stream → latest row per (crewId, metric)
function useLatestByCrewMetric(stream) {
  return useMemo(() => {
    const map = new Map(); // key: `${crewId}|${metric}` -> row
    for (const evt of stream) {
      const key = `${evt.crewId}|${evt.metric}`;
      const prev = map.get(key);
      if (!prev || new Date(evt.ts) > new Date(prev.ts)) {
        map.set(key, evt);
      }
    }
    // convert to sorted array (by crewId then metric)
    return Array.from(map.values()).sort((a, b) =>
      a.crewId === b.crewId ? a.metric.localeCompare(b.metric) : a.crewId - b.crewId
    );
  }, [stream]);
}

export default function TelemetryStatusTable({ crewId = null, metrics = null }) {
  const stream = useTelemetryStream({ crewId, metrics });
  const rows = useLatestByCrewMetric(stream);

  return (
    <div className="p-3">
      <div className="text-xl font-semibold mb-2">Current Status</div>

      <div className="border border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/30">
            <tr>
              <th className="text-left p-2">Crew</th>
              <th className="text-left p-2">Metric</th>
              <th className="text-right p-2">Value</th>
              <th className="text-left p-2">Unit</th>
              <th className="text-left p-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center opacity-70">
                  Waiting for telemetry…
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const time = r.ts ? new Date(r.ts) : new Date();
                return (
                  <tr key={`${r.crewId}-${r.metric}`} className={i % 2 ? "bg-black/10" : ""}>
                    <td className="p-2">#{r.crewId}</td>
                    <td className="p-2">{r.metric}</td>
                    <td className="p-2 text-right tabular-nums">{r.value}</td>
                    <td className="p-2">{r.unit || ""}</td>
                    <td className="p-2">{time.toLocaleTimeString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
