import { useEffect, useMemo, useState, useCallback } from "react";
import { socket, subscribeTelemetry, unsubscribeTelemetry } from "../lib/ws";

export default function useTelemetryStream({ crewId, metrics } = {}) {
  const [telemetry, setTelemetry] = useState([]);
  const MAX_ITEMS = 300;

  // 1) Make metrics a stable value + a simple dep key
  const metricsNorm = useMemo(
    () => (Array.isArray(metrics) ? [...new Set(metrics)] : []),
    [metrics]
  );
  const metricsKey = useMemo(() => metricsNorm.join(","), [metricsNorm]);

  // 2) Stable handlers so the effect can safely depend on them
  const onHello = useCallback((msg) => {
    console.debug("[ws] hello:", msg);
  }, []);

  const onTick = useCallback((msg) => {
    console.debug("[ws] tick:", msg);
  }, []);

  const onTelemetry = useCallback((evt) => {
    setTelemetry((prev) => {
      const next = [...prev, evt];
      if (next.length > MAX_ITEMS) next.splice(0, next.length - MAX_ITEMS);
      return next;
    });
  }, []);

  const onCrewEvent = useCallback((evt) => {
    console.debug("[ws] crew event:", evt);
  }, []);

  // 3) Register/unregister listeners — deps are simple identifiers, no empty []
  useEffect(() => {
    socket.on("hello", onHello);
    socket.on("tick", onTick);
    socket.on("telemetry:update", onTelemetry);
    socket.on("event:crew", onCrewEvent);

    return () => {
      socket.off("hello", onHello);
      socket.off("tick", onTick);
      socket.off("telemetry:update", onTelemetry);
      socket.off("event:crew", onCrewEvent);
    };
  }, [onHello, onTick, onTelemetry, onCrewEvent]);

  // 4) Subscribe/unsubscribe when crewId or metrics change
  useEffect(() => {
    subscribeTelemetry({ crewId, metrics: metricsNorm });
    return () => unsubscribeTelemetry({ crewId, metrics: metricsNorm });
  }, [crewId, metricsKey, metricsNorm]);

  return telemetry;
}
