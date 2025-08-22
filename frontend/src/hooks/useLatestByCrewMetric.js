// frontend/src/hooks/useLatestByCrewMetric.js
import { useMemo } from "react";
import useTelemetryStream from "./useTelemetryStream";

export default function useLatestByCrewMetric({ crewIds = null, metrics = null } = {}) {
  const stream = useTelemetryStream({ crewId: null, metrics });

  return useMemo(() => {
    const m = new Map();
    for (const evt of stream) {
      if (crewIds && !crewIds.includes(evt.crewId)) continue;
      if (metrics && !metrics.includes(evt.metric)) continue;

      const key = `${evt.crewId}|${evt.metric}`;
      const prev = m.get(key);
      if (!prev || new Date(evt.ts) > new Date(prev.ts)) {
        m.set(key, evt);
      }
    }
    return m;
  }, [stream, crewIds, metrics]); // <-- just depend on arrays directly
}
