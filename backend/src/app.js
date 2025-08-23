import '../loadEnv.js';
import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import crewRoutes from './routes/crew.js';
import telemetryIngest from './routes/internal/telemetry.js';
import triageRouter from './routes/triage.js';

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/api', crewRoutes);
app.use('/api', telemetryIngest);
app.use('/api/triage', triageRouter);

// Error handler (keep it last)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', detail: err.message });
});

export default app;