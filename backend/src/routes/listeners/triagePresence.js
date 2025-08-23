import { getClient } from '../../../database/db.js';
import { computeEffectiveSummary } from '../presence/service.js';

const CHANNELS = ['triage_presence', 'triage_change'];

export function startTriagePresenceListener({ emitPresenceUpdate, io, logger = console }) {
  let stopped = false;
  let client = null;
  let reconnectTimer = null;
  let backoffMs = 500; // exponential up to ~10s

  async function listen() {
    try {
      client = await getClient();
      await client.query(`LISTEN ${CHANNELS[0]}`);
      await client.query(`LISTEN ${CHANNELS[1]}`);

      client.on('notification', async (msg) => {
        try {
          const payload = JSON.parse(msg.payload || '{}');

          if (msg.channel === 'triage_presence' && payload.crewId) {
            const p = await computeEffectiveSummary(payload.crewId);
            if (p) emitPresenceUpdate(p);
          }

          if (msg.channel === 'triage_change') {
            // Optional: fan out triage UI updates if you want them live
            io?.emit?.('triage:update', payload);
          }
        } catch (e) {
          logger.error('[triage listener] notification error:', e.message);
        }
      });

      client.on('error', (e) => {
        logger.error('[triage listener] pg error:', e.message);
        scheduleReconnect();
      });

      client.on('end', () => {
        logger.warn('[triage listener] pg connection ended');
        scheduleReconnect();
      });

      logger.log('[triage listener] listening on channels:', CHANNELS.join(', '));
      // reset backoff after a stable connect
      backoffMs = 500;
    } catch (e) {
      logger.error('[triage listener] failed to start:', e.message);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (stopped) return;
    cleanupClient();
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      backoffMs = Math.min(backoffMs * 2, 10_000);
      listen();
    }, backoffMs);
  }

  function cleanupClient() {
    if (!client) return;
    try { client.removeAllListeners('notification'); } catch {}
    try { client.removeAllListeners('error'); } catch {}
    try { client.removeAllListeners('end'); } catch {}
    try { client.release?.(); } catch {}
    client = null;
  }

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    cleanupClient();
    logger.log('[triage listener] stopped');
  }

  // kick off
  listen();

  return { stop };
}
