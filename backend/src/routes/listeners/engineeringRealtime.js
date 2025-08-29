// backend/src/routes/listeners/engineeringRealtime.js
import { getClient } from "../../../database/db.js";

/**
 * Bridges Postgres NOTIFY -> Socket.IO for engineering metrics & events.
 * Returns a stop() function to unlisten & release the PG client.
 *
 * Emits to everyone by default; your WS can also forward to rooms.
 *
 * Channels (created by migrations):
 *  - engineering_metric_insert
 *  - engineering_event_insert
 */
export function attachEngineeringRealtime(io) {
  let released = false;
  let clientRef = null;

  const start = async () => {
    const client = await getClient.connect();
    clientRef = client;

    await client.query("LISTEN engineering_metric_insert");
    await client.query("LISTEN engineering_event_insert");

    client.on("notification", (msg) => {
      try {
        const payload = JSON.parse(msg.payload || "{}");
        if (msg.channel === "engineering_metric_insert") {
          // Global stream; parent WS can also route to rooms (see below).
          io.emit("engineering:metric", payload);
        } else if (msg.channel === "engineering_event_insert") {
          io.emit("engineering:event", payload);
        }
      } catch (e) {
        console.error("[ws][engineering] notify parse error:", e);
      }
    });

    client.on("error", (e) => {
      console.error("[ws][engineering] LISTEN connection error:", e);
    });
  };

  const stop = async () => {
    if (released) return;
    released = true;
    try {
      if (clientRef) {
        try { await clientRef.query("UNLISTEN engineering_metric_insert"); } catch {}
        try { await clientRef.query("UNLISTEN engineering_event_insert"); } catch {}
        clientRef.release();
      }
    } catch (e) {
      console.error("[ws][engineering] stop error:", e);
    }
  };

  // fire-and-forget
  start().catch((e) => {
    console.error("[ws][engineering] failed to LISTEN:", e);
  });

  return stop;
}
