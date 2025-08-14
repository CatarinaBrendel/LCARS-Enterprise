import '../loadEnv.js';
import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import api from './routes/api.js';
import { ensureSchema } from '../database/init.js';

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use('/health', healthRouter);
app.use('/api/crew_status', api);

// Error handler (keep it last)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', detail: err.message });
});

// Boot-time schema (safe to keep; no-op if table exists)
ensureSchema().catch(err => {
  console.error('Schema init failed:', err);
});
 async () =>{
  try {
    ensureSchema();
  } catch (error) {
    console.log('Schema init failed:', error);
  }
 };

export default app;