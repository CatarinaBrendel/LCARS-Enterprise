import { io } from "socket.io-client";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || "http://localhost:3001";
const WS_PATH = import.meta.env.VITE_WS_PATH || "/ws";

export const socket = io(API_ORIGIN, {
  path: WS_PATH,
  transports: ["websocket"],
  autoConnect: true,
  withCredentials: true,
});

// Simple helpers so components don’t need to remember event names
export function subscribeTelemetry({ crewId, metrics } = {}) {
  socket.emit("telemetry:subscribe", { crewId, metrics });
}
export function unsubscribeTelemetry({ crewId, metrics } = {}) {
  socket.emit("telemetry:unsubscribe", { crewId, metrics });
}
