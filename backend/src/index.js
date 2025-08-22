import '../loadEnv.js';
import http from 'http';
import app from './app.js';
import { ensureSchema } from '../database/init.js';
import cron from 'node-cron';
import { runRetentionOnce } from './retention.js';
import { initWebSocket } from './websocket.js';

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
const { io, emitTelemetry, emitCrewEvent } = initWebSocket(server, {
  corsOrigin: CORS_ORIGIN,
});

app.set("ws", { io, emitTelemetry, emitCrewEvent });

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

// optional: graceful shutdown
function shutdown(sig) {
  console.log(`\n${sig} received, shutting down...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => shutdown(s)));

// Europe/Berlin daily at 03:15
const CRON = process.env.RETENTION_CRON ?? '15 3 * * *';

// Cron job to clean up the metrics perioodically 
if (process.env.START_RETENTION !== 'false') {
  cron.schedule(CRON, () => {
    runRetentionOnce(console).catch(err => console.error('[retention] error', err));
  }, { timezone: 'Europe/Berlin' });
}

// expose readiness to app (health route can read it)
app.set('ready', () => ready);