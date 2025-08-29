import { Server } from "socket.io";
import { attachMissionRealtime } from "./routes/internal/missionRealTime.js";
import { fetchNewMission } from "./routes/presence/service.js";
import { attachEngineeringRealtime } from "./routes/listeners/engineeringRealtime.js";

export function initWebSocket(httpServer, { corsOrigin }) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    path: "/ws",
    transports: ["websocket"],
  });

  io.on("connection", (socket) => {
    console.log("[ws] connected", socket.id);
    socket.emit("hello", { serverTime: Date.now() });

    // --- Telemetry ---
    socket.on("telemetry:subscribe", ({ crewId, metrics } = {}) => {
      if (crewId) socket.join(`crew:${crewId}`);
      if (Array.isArray(metrics)) metrics.forEach((m) => socket.join(`metric:${m}`));
    });

    socket.on("telemetry:unsubscribe", ({ crewId, metrics } = {}) => {
      if (crewId) socket.leave(`crew:${crewId}`);
      if (Array.isArray(metrics)) metrics.forEach((m) => socket.leave(`metric:${m}`));
    });

    // ---- Mission subscriptions ----
    socket.on("mission:subscribe", ({ missionId } = {}) => {
      socket.join("mission:all");
      if (missionId) socket.join(`mission:${missionId}`);
      console.log("[ws] mission:subscribe", socket.id, { missionId, rooms: [...socket.rooms] });
      socket.emit("mission:subscribed", { ok: true, missionId: missionId ?? null });
    });

    socket.on("mission:unsubscribe", ({ missionId } = {}) => {
      socket.leave("mission:all");
      if (missionId) socket.leave(`mission:${missionId}`);
    });

    // ---- Engineering subscriptions ----
    socket.on("engineering:subscribe", ({ systems, metrics, parts } = {}) => {
      socket.join("engineering");
      if (Array.isArray(systems)) systems.forEach((s) => socket.join(`eng:system:${s}`));
      if (Array.isArray(metrics)) metrics.forEach((m) => socket.join(`eng:metric:${m}`));
      if (Array.isArray(parts)) parts.forEach((p) => socket.join(`eng:part:${p}`));
      socket.emit("engineering:subscribed", {
        ok: true,
        systems: systems ?? null,
        metrics: metrics ?? null,
        parts: parts ?? null,
      });
    });

    socket.on("engineering:unsubscribe", ({ systems, metrics, parts } = {}) => {
      socket.leave("engineering");
      if (Array.isArray(systems)) systems.forEach((s) => socket.leave(`eng:system:${s}`));
      if (Array.isArray(metrics)) metrics.forEach((m) => socket.leave(`eng:metric:${m}`));
      if (Array.isArray(parts)) parts.forEach((p) => socket.leave(`eng:part:${p}`));
    });

    socket.on("disconnect", () => {
      console.log("[ws] disconnected", socket.id);
    });
  });

  // Helper broadcasters
  // --- Telemetry ---
  function emitTelemetry({ crewId, metric, value, unit, ts = new Date() }) {
    const payload = { crewId, metric, value, unit, ts };
    io.emit("telemetry:update", payload);
    if (crewId) io.to(`crew:${crewId}`).emit("telemetry:update", payload);
    if (metric) io.to(`metric:${metric}`).emit("telemetry:update", payload);
  }

  // --- Crew ---
  function emitCrewEvent({ crewId, type, message, ts = new Date() }) {
    const payload = { crewId, type, message, ts };
    io.emit("event:crew", payload);
    if (crewId) io.to(`crew:${crewId}`).emit("event:crew", payload);
  }

  // --- Presence ---
  function emitPresenceUpdate({ crewId, onDuty, busy, deck_zone, ts = new Date() }) {
    const payload = { crewId, onDuty, busy, deck_zone, ts };
    io.emit("presence:update", payload);
    io.to("presence").emit("presence:update", payload);
    if (crewId) io.to(`crew:${crewId}`).emit("presence:update", payload);
  }

  function emitPresenceSummary({ total, onDuty, busy, busyPct, ts = new Date() }) {
    const payload = { total, onDuty, busy, busyPct, ts };
    io.emit("presence:summary", payload);
  }

  // --- Mission (helpers) ---
  const stopMissionRealtime = attachMissionRealtime(io);
  function emitMissionStatus(missionId, status) {
    const payload = { missionId, status };
    io.emit("mission:status", payload);
    io.to("mission:all").emit("mission:status", payload);
    if (missionId) io.to(`mission:${missionId}`).emit("mission:status", payload);
  }
  function emitMissionProgress(missionId, progress_pct) {
    const payload = { missionId, progress_pct: Number(progress_pct) || 0 };
    io.emit("mission:progress", payload);
    io.to("mission:all").emit("mission:progress", payload);
    if (missionId) io.to(`mission:${missionId}`).emit("mission:progress", payload);
  }
  function emitMissionObjective(missionId, objective_id, to, from) {
    const payload = { missionId, objective_id, to, ...(from ? { from } : {}) };
    if (missionId) io.to(`mission:${missionId}`).emit("mission:objective", payload);
  }
  function emitMissionEvent(missionId, kind, payload = {}) {
    const ev = { missionId, kind, payload };
    io.emit("mission:event", ev);
    if (missionId) io.to(`mission:${missionId}`).emit("mission:event", ev);
  }
  async function emitMissionCreated(missionId) {
    try {
      const mission = await fetchNewMission(missionId);
      console.log("[ws] emitting mission:created", { missionId, code: mission?.code });
      io.to("mission:all").emit("mission:created", mission);
      if (missionId) io.to(`mission:${missionId}`).emit("mission:created", mission);
      emitMissionStatus(missionId, mission.status ?? "planned");
      emitMissionProgress(missionId, Number(mission.progress_pct) || 0);
      emitMissionEvent(missionId, "created", { via: "ws" });
    } catch (error) {
      console.error("[ws] emitMissionCreated error:", error);
    }
  }

  // --- Engineering (helpers) ---
  function emitEngineeringMetric({ system, metric, part = null, value_num = null, value_text = null, unit = null, status = null, ts = new Date() }) {
    const payload = { system, metric, part, value_num, value_text, unit, status, ts };
    io.emit("engineering:metric", payload);
    io.to("engineering").emit("engineering:metric", payload);
    if (system) io.to(`eng:system:${system}`).emit("engineering:metric", payload);
    if (metric) io.to(`eng:metric:${metric}`).emit("engineering:metric", payload);
    if (part)   io.to(`eng:part:${part}`).emit("engineering:metric", payload);
  }
  
  function emitEngineeringEvent({ system, severity = "info", message, context = {}, ts = new Date() }) {
    const payload = { system, severity, message, context, ts };
    io.emit("engineering:event", payload);
    io.to("engineering").emit("engineering:event", payload);
    if (system) io.to(`eng:system:${system}`).emit("engineering:event", payload);
  }

  const stopEngineeringRealtime = attachEngineeringRealtime(io);

  return {
    io,
    emitTelemetry,
    emitCrewEvent,
    emitPresenceSummary,
    emitPresenceUpdate,
    emitMissionStatus,
    emitMissionProgress,
    emitMissionObjective,
    emitMissionEvent,
    emitMissionCreated,
    emitEngineeringMetric,
    emitEngineeringEvent,
    stopMissionRealtime,
    stopEngineeringRealtime,
  };
}
