import '../loadEnv.js';
import http from 'http';
import app from './app.js';
import { ensureSchema } from '../database/init.js';
import cron from 'node-cron';
import { runRetentionOnce } from './retention.js';
import { initWebSocket } from './websocket.js';
import { startSimulator } from './routes/simulators/simulator.js';
import {startPresenceSimulator} from  './routes/simulators/presenceSimulator.js';
import {startTriagePresenceListener} from './routes/listeners/triagePresence.js';
import {startTriageSimulator } from './routes/simulators/triageSimulator.js';
import { startPresenceSummaryTicker } from './routes/simulators/tickers/presenceSimulatorTicker.js';
import { startMissionSimulator } from './routes/simulators/missionSimulator.js';
import { startMissionGenerator } from './routes/simulators/missionGenerator.js';

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '0.0.0.0'; 
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';
const STARTUP_MIGRATE = (process.env.STARTUP_MIGRATE || 'background').toLowerCase(); // 'background' | 'block' | 'off'
const STARTUP_SEED = String(process.env.STARTUP_SEED || 'false') === 'true';

let ready = false; // flips true when DB is usable

const server = http.createServer(app);

// Helpers
const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

// Websockets
const { 
  io, 
  emitTelemetry, 
  emitCrewEvent, 
  emitPresenceSummary, 
  emitPresenceUpdate, 
  stopMissionRealtime, 
  emitMissionStatus,
  emitMissionProgress,
  emitMissionObjective,
  emitMissionEvent,
  emitMissionCreated,
} = initWebSocket(server, {
  corsOrigin: CORS_ORIGIN,
});

app.set("ws", { 
  io, 
  emitTelemetry, 
  emitCrewEvent, 
  emitPresenceSummary, 
  stopMissionRealtime,
  emitMissionStatus,
  emitMissionProgress,
  emitMissionObjective,
  emitMissionEvent,
  emitMissionCreated, 
});

// ---- Simulators toggles ----
if (process.env.ENABLE_SIM === 'true') {
  startSimulator({ emitTelemetry, intervalMs: 1000 })
    .then((stop) => app.set('simStop', stop))
    .catch((err) => console.error('[sim] failed to start', err));

  startPresenceSimulator({ emitPresenceUpdate, emitPresenceSummary })
    .then((stop) => app.set('simStopPresence', stop))
    .catch((err) => console.error('[sim] presence failed to start', err));
}

// --- Presence ---
// start the periodic summary (toggle via env)
if (process.env.ENABLE_PRESENCE_SUMMARY !== 'false') {
  const stop = startPresenceSummaryTicker({
    emitPresenceSummary,
    intervalMs: Number(process.env.PRESENCE_SUMMARY_INTERVAL_MS) || 10_000,
  });
  app.set('presenceSummaryStop', stop);
}

// --- Triage ---
if (process.env.ENABLE_TRIAGE_SIM === 'true') {
  const stop = startTriageSimulator({
    // your existing knobs
    intervalMs: Number(process.env.TRIAGE_SIM_INTERVAL_MS) || 5_000,
    admitChance: Number(process.env.TRIAGE_SIM_ADMIT_CHANCE) || 0.25,
    maxConcurrent: Number(process.env.TRIAGE_SIM_MAX) || 4,

    // NEW knobs for the condition ladder + timing
    TICKS_PER_HOUR: Number(process.env.TRIAGE_SIM_TPH) || 12,       // 1 sim hour ≈ 1 minute at 5s ticks
    observationHoursAtGood: Number(process.env.TRIAGE_SIM_OBS_H) || 1,
    stepHours: {
      critical: Number(process.env.TRIAGE_SIM_STEP_CRIT) || 6,
      serious:  Number(process.env.TRIAGE_SIM_STEP_SER ) || 6,
      stable:   Number(process.env.TRIAGE_SIM_STEP_STAB) || 2,
      fair:     Number(process.env.TRIAGE_SIM_STEP_FAIR) || 1,
    },
    minTotalHoursByInitial: {
      critical: Number(process.env.TRIAGE_SIM_MIN_CRIT) || 24,
      serious:  Number(process.env.TRIAGE_SIM_MIN_SER ) || 24,
      stable:   Number(process.env.TRIAGE_SIM_MIN_STAB) || 6,
      fair:     Number(process.env.TRIAGE_SIM_MIN_FAIR) || 2,
      good:     Number(process.env.TRIAGE_SIM_MIN_GOOD) || 0,
    },

    logger: console,
  });
  app.set('triageSimStop', stop);
}

// -- Mission Generator --
if(process.env.ENABLE_MISSION_GENERATOR === 'true') {
  const {emitMissionCreated} = app.get('ws') || {};
  console.log('[missionGen] ENABLED, typeof emitMissionCreated =', typeof emitMissionCreated);
  if (!emitMissionCreated) {
    console.warn("[missionGen] WARNING: no emitMissionCreated bound, missions won't reach clients");
  }
  const stop = startMissionGenerator({emitMissionCreated});
  app.set('missionGenStop', stop);
};

// DB Listeners
let triageListener;
if (process.env.ENABLE_DB_LISTENERS !== 'false') {
  triageListener = startTriagePresenceListener({
    emitPresenceUpdate,
    io,
    logger: console,
  });
}

// Mission simulator (start ONCE; pass helpers)
if (process.env.ENABLE_MISSION_SIM === 'true' && process.env.NODE_ENV !== 'test') {
  const stop = await startMissionSimulator({
    emitMissionStatus,
    emitMissionProgress,
    emitMissionObjective,
    emitMissionEvent,
    intervalMs: Number(process.env.MISSION_SIM_INTERVAL_MS) || 3000,
  });
  app.set('missionSimStop', stop);
}

// Keep track of listeners/stoppers for clean shutdown
app.set('listeners', {
  ...(app.get('listeners') || {}),
  triage: triageListener && { stop: triageListener.stop?.bind(triageListener) },
  mission: { stop: stopMissionRealtime }
});

// --- Start HTTP --- 
async function start() {
  const dbname = new URL(process.env.DATABASE_URL).pathname.replace(/^\//,'');
  if (process.env.NODE_ENV === 'production' && /_test$/i.test(dbname)) {
    throw new Error('Refusing to start in production against a test database');
  }
  
  if (STARTUP_MIGRATE === 'block') {
    // do migrations first; report readiness after success
    try {
      await withTimeout(ensureSchema({ seed: STARTUP_SEED }), 30000, 'ensureSchema');
      ready = true;
      console.log('Schema init (block): OK');
    } catch (e) {
      console.warn('Schema init (block) failed:', e.message);
      // still start the server so /health can report not-ready
    }
    server.listen(PORT, HOST, () =>
      console.log(`API listening on http://${HOST}:${PORT}`)
    );
  } else {
    // start the server immediately so health endpoint responds
    server.listen(PORT, HOST, () =>
      console.log(`API listening on http://${HOST}:${PORT}`)
    );

    if (STARTUP_MIGRATE === 'background') {
      setImmediate(async () => {
        try {
          await ensureSchema({ seed: STARTUP_SEED });
          ready = true;
          console.log('Schema init (background): OK');
        } catch (e) {
          console.warn('Schema init (background) failed:', e.message);
        }
      });
    } else {
      // off: mark ready without migrations (dev only)
      ready = true;
    }
  }
}

start().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});

// --- Graceful shutdown ---
function shutdown(sig) {
  console.log(`\n${sig} received, shutting down...`);

  // stop background loops/listeners first
  try { app.get('listeners')?.triage?.stop?.(); } catch (e) { console.error('[shutdown] triage stop:', e?.message); }
  try { app.get('listeners')?.mission?.stop?.(); } catch (e) { console.error('[shutdown] mission rt stop:', e?.message); }
  try { app.get('simStop')?.(); } catch (e) { console.error('[shutdown] sim stop:', e?.message); }
  try { app.get('ws')?.io?.close?.(); } catch (e) { console.error('[shutdown] ws close:', e?.message); }
  try { app.get('triageSimStop')?.(); } catch (e) { console.error('[shutdown] triage-sim stop:', e?.message); }
  try { app.get('missionSimStop')?.(); } catch (e) { console.error('[shutdown] mission-sim stop:', e?.message); }
  try { app.get('presenceSummaryStop')?.(); } catch (e) { console.error('[shutdown] presence-summary stop:', e?.message); }
  try { app.get('missionGenStop')?.(); } catch (e) { console.error('[shutdown] mission-gen stop:', e?.message); }

  // close HTTP server (stops accepting new conns)
  server.close(async () => {
    console.log('HTTP server closed.');

    // 3) release any checked-out PG clients, then end the pool
    try { await forceReleaseAllClients(); } catch {}
    try { await endPool(); } catch (e) { console.error('[shutdown] pg pool end:', e?.message); }

    process.exit(0);
  });

  // safety timer: if something hangs, force exit non-zero
  setTimeout(async () => {
    try { await endPool(); } catch {}
    process.exit(1);
  }, 10_000).unref();
}

// keep your signals
['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => shutdown(s)));

// Europe/Berlin daily at 03:15
const CRON = process.env.RETENTION_CRON ?? '15 3 * * *';

// --- Retention cron job (Europe/Berlin daily at 03:15) --- 
if (process.env.START_RETENTION !== 'false') {
  cron.schedule(CRON, () => {
    runRetentionOnce(console).catch(err => console.error('[retention] error', err));
  }, { timezone: 'Europe/Berlin' });
}

// expose readiness to app (health route can read it)
app.set('ready', () => ready);