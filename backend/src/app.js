import '../loadEnv.js';
import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
//import auth from './routes/api/auth.js';
import crew_status from './routes/api/crew-status.js';
//import crew from './routes/api/crew-status.js';
import { ensureSchema } from '../database/init.js';

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Routes
app.use('/health', healthRouter);
//app.use('/api/auth', auth);
app.use('/api/crew_status', crew_status);
//app.use('/api/crew', crew);


// Error handler (keep it last)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', detail: err.message });
});

export default app;