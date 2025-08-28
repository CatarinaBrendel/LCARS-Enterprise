import { getClient } from '../../../database/db.js';
import { computeEffectiveSummary } from '../presence/service.js';

const CHANNELS = ['triage_presence', 'triage_change'];

async function fetchVisitWithName(visitId, logger) {
  let c;
  try {
    c = await getClient();
    const { rows } = await c.query(`
      SELECT v.id,
             v.crew_id      AS "crewId",
             c.name         AS "full_name",   -- in case you only store one field
             v.state, v.acuity, v.bed, v.ended_at
        FROM triage_visit v
        JOIN crew c ON c.id = v.crew_id
       WHERE v.id = $1
    `, [visitId]);
    return rows[0] || null;
  } catch (e) {
    logger?.error?.('[triage listener] fetchVisitWithName error:', e.message);
    return null;
  } finally {
    try { c?.release?.(); } catch {}
  }
}

// helper: standardize display name once
function makeDisplayName(row) {
  const given = row?.first_name ?? row?.given_name ?? null;
  const surname = row?.last_name ?? row?.surname ?? null;
  if (surname && given) return `${surname}, ${given}`;
  if (surname) return surname;
  if (given) return given;
  const full = row?.full_name ?? row?.name ?? null;
  if (typeof full === 'string' && full.trim()) {
    const parts = full.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts.at(-1)}, ${parts.slice(0, -1).join(' ')}`;
    return full;
  }
  return row?.crewId ? `#${row.crewId}` : '—';
}

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

          if (msg.channel === 'triage_change') {
            // 1) Enrich with crew name from DB (single SELECT by visit id)
            if (payload?.id) {
              const row = await fetchVisitWithName(payload.id, logger);
              if (row) {
                const enriched = {
                  ...payload,
                  ...row, // ensures crewId/state/acuity/bed/ended_at are present
                  name: row.full_name,                 // keep legacy "name" if you have it
                  displayName: makeDisplayName(row),   // normalized "Surname, Given"
                };
                io?.emit?.('triage:update', enriched);
                return;
              }
            }
            
            // 2) Fallback: emit what we got (no name). Frontend can keep prior displayName.
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
