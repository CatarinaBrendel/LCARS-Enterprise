import { Server } from "socket.io";
import {attachMissionRealtime } from './routes/internal/missionRealTime.js';
import { fetchNewMission } from "./routes/presence/service.js";

/**
 * Event schema (recommendation)
 * - server → client:
 *   'telemetry:update' { crewId, metric, value, unit, ts }
 *   'event:crew'       { crewId, type, message, ts }
 *   'presence:update'   { crewId, onDuty, busy, deck_zone, ts }
 *   'presence:summary'  { total, onDuty, busy, busyPct, ts }
 *   'hello'            { serverTime }
 *
 * - client → server:
 *   'telemetry:subscribe'   { crewId? , metrics? } // join rooms
 *   'telemetry:unsubscribe' { crewId? , metrics? } // leave rooms
 */

export function initWebSocket(httpServer, {corsOrigin}) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    path: "/ws",
    transports: ["websocket"],
  });

  // Namespaces (optional): keep it simple for now
  io.on("connection", (socket) => {
    console.log("[ws] connected", socket.id);
    socket.emit("hello", { serverTime: Date.now() });
    
    // --- Telemetry ---
    socket.on("telemetry:subscribe", ({ crewId, metrics } = {}) => {
      if (crewId) socket.join(`crew:${crewId}`);
      if (Array.isArray(metrics)) metrics.forEach(m => socket.join(`metric:${m}`));
    });

    socket.on("telemetry:unsubscribe", ({ crewId, metrics } = {}) => {
      if (crewId) socket.leave(`crew:${crewId}`);
      if (Array.isArray(metrics)) metrics.forEach(m => socket.leave(`metric:${m}`));
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

    socket.on("disconnect", () => {
      console.log("[ws] disconnected", socket.id);
    });
  });

  // Helper broadcasters
  // --- Telemetry ---
  function emitTelemetry({ crewId, metric, value, unit, ts = new Date() }) {
    const payload = { crewId, metric, value, unit, ts };
    // broadcast to general stream + crew room + metric room
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
    io.emit("presence:update", payload);               // everyone
    io.to("presence").emit("presence:update", payload); // subscribers
    if (crewId) io.to(`crew:${crewId}`).emit("presence:update", payload);
  }

  function emitPresenceSummary({ total, onDuty, busy, busyPct, ts = new Date() }) {
    const payload = { total, onDuty, busy, busyPct, ts };
    io.emit("presence:summary", payload);
  }

  // --- Mission (helpers you can call from routes/sim/seeders) ---
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

  // Call this right after inserting a new mission in the DB
  async function emitMissionCreated(missionId) {
    try {
      const mission = await fetchNewMission(missionId);
      console.log("[ws] emitting mission:created", { missionId, code: mission?.code });
      // broadcast creation
      io.to("mission:all").emit("mission:created", mission);
      if (missionId) io.to(`mission:${missionId}`).emit("mission:created", mission);

      // (optional) keep the existing signals for listeners that rely on them
      emitMissionStatus(missionId, mission.status ?? "planned");
      emitMissionProgress(missionId, Number(mission.progress_pct) || 0);
      emitMissionEvent(missionId, "created", { via: "ws" });
    } catch(error) {
      console.error("[ws] emitMissionCreated error:", error);
    }
  }

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
    stopMissionRealtime 
  };
}
