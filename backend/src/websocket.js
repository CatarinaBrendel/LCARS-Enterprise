import { Server } from "socket.io";

/**
 * Event schema (recommendation)
 * - server → client:
 *   'telemetry:update' { crewId, metric, value, unit, ts }
 *   'event:crew'       { crewId, type, message, ts }
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

    // Room strategy:
    // - crew rooms: `crew:<id>`
    // - metric rooms: `metric:<name>`
    // - combo room (optional): `crew:<id>:metric:<name>`
    socket.on("telemetry:subscribe", ({ crewId, metrics } = {}) => {
      if (crewId) socket.join(`crew:${crewId}`);
      if (Array.isArray(metrics)) metrics.forEach(m => socket.join(`metric:${m}`));
    });

    socket.on("telemetry:unsubscribe", ({ crewId, metrics } = {}) => {
      if (crewId) socket.leave(`crew:${crewId}`);
      if (Array.isArray(metrics)) metrics.forEach(m => socket.leave(`metric:${m}`));
    });

    socket.on("disconnect", () => {
      console.log("[ws] disconnected", socket.id);
    });
  });

  // Helper broadcasters
  function emitTelemetry({ crewId, metric, value, unit, ts = new Date() }) {
    const payload = { crewId, metric, value, unit, ts };
    // broadcast to general stream + crew room + metric room
    io.emit("telemetry:update", payload);
    if (crewId) io.to(`crew:${crewId}`).emit("telemetry:update", payload);
    if (metric) io.to(`metric:${metric}`).emit("telemetry:update", payload);
  }

  function emitCrewEvent({ crewId, type, message, ts = new Date() }) {
    const payload = { crewId, type, message, ts };
    io.emit("event:crew", payload);
    if (crewId) io.to(`crew:${crewId}`).emit("event:crew", payload);
  }

  return { io, emitTelemetry, emitCrewEvent };
}
