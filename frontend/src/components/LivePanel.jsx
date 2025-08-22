import React from "react";
import useTelemetryStream from "../hooks/useTelemetryStream";

export default function LivePanel({ crewId = null, metrics = null }) {
  const data = useTelemetryStream({ crewId, metrics });

  return (
    <div className="p-4 space-y-3">
      <div className="text-xl font-semibold">Live Telemetry</div>
      <div className="text-xs opacity-70">
        Subscribed: {crewId ? `crew:${crewId}` : "all crews"}
        {metrics?.length ? ` | metrics: ${metrics.join(", ")}` : " | all metrics"}
      </div>
      <ul className="text-sm max-h-96 overflow-auto space-y-1">
        {data.slice(-100).map((d, i) => (
          <li key={i}>
            <span className="opacity-60">{new Date(d.ts || Date.now()).toLocaleTimeString()}</span>{" "}
            <strong>#{d.crewId}</strong>{" "}
            <span>{d.metric}</span>: <span>{d.value}</span>{" "}
            <span className="opacity-70">{d.unit || ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
