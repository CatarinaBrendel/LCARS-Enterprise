import '../loadEnv.js';
import express from 'express';
import cors from 'cors';
import healthRouter from './routes/healthRoute.js';
import crewRoutes from './routes/crewRoute.js';
import telemetryIngest from './routes/internal/telemetry.js';
import triageRouter from './routes/triageRoute.js';
import missionRouters from './routes/missionRoute.js';
import engineeringRoute from './routes/engineeringRoute.js';

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/api', crewRoutes);
app.use('/api', telemetryIngest);
app.use('/api/triage', triageRouter);
app.use('/api/missions', missionRouters);
app.use('/api/engineering', engineeringRoute);

// Error handler (keep it last)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', detail: err.message });
});

export default app;