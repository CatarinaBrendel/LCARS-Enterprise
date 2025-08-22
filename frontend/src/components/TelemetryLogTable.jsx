import React from "react";
import useTelemetryStream from "../hooks/useTelemetryStream";

export default function TelemetryLogTable({ crewId = null, metrics = null, maxRows = 200 }) {
  const stream = useTelemetryStream({ crewId, metrics });
  const rows = stream.slice(-maxRows); // last N only

  return (
    <div className="p-3">
      <div className="text-xl font-semibold mb-2">Live Telemetry (Log)</div>

      <div className="border border-gray-700 rounded overflow-hidden max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-black/30 sticky top-0">
            <tr>
              <th className="text-left p-2">Time</th>
              <th className="text-left p-2">Crew</th>
              <th className="text-left p-2">Metric</th>
              <th className="text-right p-2">Value</th>
              <th className="text-left p-2">Unit</th>
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
                  <tr key={i} className={i % 2 ? "bg-black/10" : ""}>
                    <td className="p-2">{time.toLocaleTimeString()}</td>
                    <td className="p-2">#{r.crewId}</td>
                    <td className="p-2">{r.metric}</td>
                    <td className="p-2 text-right tabular-nums">{r.value}</td>
                    <td className="p-2">{r.unit || ""}</td>
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
