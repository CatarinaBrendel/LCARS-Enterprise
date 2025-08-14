import '../loadEnv.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';

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

(async () => {
  if (process.env.NODE_ENV !== 'test') {
    await ensureSchema({ seed: true });   // or seed: process.env.SEED !== 'false'
  }
  const server = http.createServer(app);
  server.listen(PORT, HOST, () => {
    console.log(`API listening on http://${HOST}:${PORT}`);
  });
})();
