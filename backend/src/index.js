import '../loadEnv.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { ensureSchema } from '../database/init.js';

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '0.0.0.0'; 
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: CORS_ORIGIN }
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  socket.emit('hello', { message: 'Welcome!' });

  const interval = setInterval(() => {
    socket.emit('tick', { at: new Date().toISOString() });
  }, 5000);

  socket.on('disconnect', () => clearInterval(interval));
});

// tiny helper
const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

const STARTUP_MIGRATE = process.env.STARTUP_MIGRATE ?? 'background'; // 'background' | 'block' | 'off'
const STARTUP_SEED = process.env.STARTUP_SEED === 'true';

(async () => {
  // 1) start HTTP immediately so /health responds for the healthcheck
  const server = http.createServer(app);
  server.listen(PORT, HOST, () => {
    console.log(`API listening on http://${HOST}:${PORT}`);
  });

  // 2) run migrations/seed without blocking readiness
  if (STARTUP_MIGRATE === 'background') {
    setImmediate(() => {
      ensureSchema({ seed: STARTUP_SEED })
        .then(() => console.log('Schema init (bg): OK'))
        .catch(e => console.warn('Schema init (bg) failed:', e.message));
    });
  } else if (STARTUP_MIGRATE === 'block') {
    try {
      await withTimeout(ensureSchema({ seed: STARTUP_SEED }), 15000, 'ensureSchema');
      console.log('Schema init (block): OK');
    } catch (e) {
      console.warn('Schema init (block) failed:', e.message);
    }
  } // 'off' → do nothing
})();
