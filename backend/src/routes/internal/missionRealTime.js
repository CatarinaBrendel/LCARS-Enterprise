// src/realtime/missionRealtime.js
import { getClient } from '../../../database/db.js';

/**
 * Subscribes to NOTIFY 'rt_mission' and forwards payloads to:
 *  - room "mission:all"
 *  - room `mission:<id>`
 * Emits event: 'mission:changed' with the DB payload.
 */

export function attachMissionRealtime(io) {
  let client;
  let onNotification;

  (async () => {
    client = await getClient();           // dedicated PG client
    await client.query("LISTEN rt_mission");

    onNotification = (msg) => {
      try {
        const payload = JSON.parse(msg.payload || "{}");
        const missionId = payload?.mission_id;
        if (!missionId) return;

        io.to("mission:all").emit("mission:changed", payload);
        io.to(`mission:${missionId}`).emit("mission:changed", payload);
      } catch (err) {
        console.error("[rt_mission] bad payload", msg.payload, err);
      }
    };

    client.on("notification", onNotification);
    console.log("[rt_mission] listening…");
  })().catch((e) => console.error("[rt_mission] init failed", e));

  // disposer
  return async function stop() {
    try {
      if (client && onNotification) client.off("notification", onNotification);
      if (client) {
        try { await client.query("UNLISTEN rt_mission"); } catch {}
        client.release?.();
      }
      console.log("[rt_mission] stopped");
    } catch (e) {
      console.error("[rt_mission] stop error", e);
    }
  };
}
