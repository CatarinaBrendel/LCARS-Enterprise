import { io } from "socket.io-client";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3001";
const WS_PATH = import.meta.env.VITE_WS_PATH || "/ws";

export const socket = io(API_ORIGIN, {
  path: WS_PATH,
  transports: ["websocket"],
  autoConnect: true,
  withCredentials: true,
});

export function getSocket() {
  return socket;
}

// Telemetry subscriptions
export function subscribeTelemetry({ crewId, metrics } = {}) {
  socket.emit("telemetry:subscribe", { crewId, metrics });
}
export function unsubscribeTelemetry({ crewId, metrics } = {}) {
  socket.emit("telemetry:unsubscribe", { crewId, metrics });
}

// Mission subscriptions
export function subscribeMission({ missionId } = {}) {
  socket.emit("mission:subscribe", { missionId });
}
export function unsubscribeMission({ missionId } = {}) {
  socket.emit("mission:unsubscribe", { missionId });
}
export function onMissionChanged(handler) {
  socket.on("mission:changed", handler);
  return () => socket.off("mission:changed", handler);
}
