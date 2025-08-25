import { getClient } from '../../database/db.js';

/** Subscribes to NOTIFY 'rt_mission' and forwards payloads to a callback */
export async function createMissionPgListener(onPayload) {
  const client = await getClient(); // dedicated client
  await client.query('LISTEN rt_mission');

  const handler = async (msg) => {
    try {
      const payload = JSON.parse(msg.payload || '{}');
      await onPayload(payload);
    } catch (e) {
      console.error('[rt_mission] bad payload:', msg.payload, e);
    }
  };

  client.on('notification', handler);

  return {
    close: async () => {
      client.off('notification', handler);
      try { await client.query('UNLISTEN rt_mission'); } catch {}
      client.release?.();
    }
  };
}
