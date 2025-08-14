import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use('/health', healthRouter);

export default app;