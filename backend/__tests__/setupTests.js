import '../loadEnv.js';
import { teardown } from './_teardown.js';

// prove the cron mock is used (optional)
try { /* eslint-disable no-console */ console.log('[setup] node-cron ->', require.resolve('node-cron')); } catch {}

// silence the seed warning only
if (process.env.NODE_ENV === 'test') {
  const originalError = console.error;
  console.error = (...args) => {
    if (String(args?.[0] ?? '').startsWith('Seed failed')) return;
    originalError(...args);
  };
}

afterAll(async () => { await teardown(); });
