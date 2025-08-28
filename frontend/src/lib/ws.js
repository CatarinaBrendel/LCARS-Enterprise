import { io } from "socket.io-client";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3001";
const WS_PATH = import.meta.env.VITE_WS_PATH || "/ws";

export const socket = io(API_ORIGIN, {
  path: WS_PATH,
  transports: ["websocket"],
  autoConnect: true,
  withCredentials: true,
});

// --- DEBUG: remove when done ---
if (typeof window !== "undefined") {
  window._ws = socket; // handy in DevTools
}
socket.on("connect",    () => console.log("[ws] connected", socket.id));
socket.on("connect_error", (err) => console.warn("[ws] connect_error", err?.message || err));
socket.on("disconnect", (r) => console.log("[ws] disconnected", r));
socket.onAny((event, ...args) => {
  if (String(event).startsWith("mission:")) {
    console.log("[ws] event", event, args?.[0]);
  }
});
// --- DEBUG end ---

export function getSocket() {
  return socket;
}

// remeber mission rooms to rejoin on reconnect
let subscribeAll = false;
const missionRooms = new Set();

// Telemetry subscriptions
export function subscribeTelemetry({ crewId, metrics } = {}) {
  socket.emit("telemetry:subscribe", { crewId, metrics });
}

export function unsubscribeTelemetry({ crewId, metrics } = {}) {
  socket.emit("telemetry:unsubscribe", { crewId, metrics });
}

// Mission subscriptions
export function subscribeMission({ missionId } = {}) {
  const payload = missionId ? { missionId } : {};
  if (!socket.connected) {
    // queue until connected to avoid an early emit being lost in some setups
    socket.once("connect", () => socket.emit("mission:subscribe", payload));
  } else {
    socket.emit("mission:subscribe", payload);
  }
  if(missionId) missionRooms.add(missionId);
  else subscribeAll = true;
}

export function unsubscribeMission({ missionId } = {}) {
  const payload = missionId ? { missionId } : {};
  if (!socket.connected) {
    socket.once("connect", () => socket.emit("mission:unsubscribe", payload));
  } else {
    socket.emit("mission:unsubscribe", payload);
  }
  if(missionId) missionRooms.delete(missionId);
  else subscribeAll = false;
}

// rejoin after reconnect
socket.on("connect", () => {
  if(subscribeAll) socket.emit("mission:subscribe", {});
  for(const id of missionRooms) socket.emit("mission:subscribe", {missionId: id});
});

// Fine-grained mission listeners
export function onMissionProgress(handler) {
  socket.on("mission:progress", handler);
  return () => socket.off("mission:progress", handler);
}
export function onMissionStatus(handler) {
  socket.on("mission:status", handler);
  return () => socket.off("mission:status", handler);
}
export function onMissionObjective(handler) {
  socket.on("mission:objective", handler);
  return () => socket.off("mission:objective", handler);
}
export function onMissionEvent(handler) {
  socket.on("mission:event", handler);
  return () => socket.off("mission:event", handler);
}

export function onMissionCreated(handler) {
  console.debug('[ws] onMissionCreated: registering handler', handler);
  socket.on('mission:created', handler);
  return () => {
    console.debug('[ws] onMissionCreated: removing handler', handler);
    socket.off('mission:created', handler);
  }
}

// Back-compat aggregator: normalize multiple events into one stream
export function onMissionChanged(handler) {
  const off1 = onMissionProgress((p) => handler({ type: "progress", ...p }));
  const off2 = onMissionStatus((p) => handler({ type: "status", ...p }));
  const off3 = onMissionObjective((p) => handler({ type: "objective", ...p }));
  const off4 = onMissionEvent((p) => handler({ type: "event", ...p }));
  return () => { off1(); off2(); off3(); off4(); };
}