// backend/loadEnv.js (or at project root if you prefer)
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend dir and repo root
const backendRoot = path.resolve(__dirname, '.');
const repoRoot = path.resolve(__dirname, '..');


// Decide which file to load
const isTest = process.env.NODE_ENV === 'test';
const candidates = [
  // Prefer a backend-local .env.test when in NODE_ENV=test
  isTest ? path.join(backendRoot, '.env.test') : null,
  // Then backend/.env
  path.join(backendRoot, '.env'),
  // Finally repo root .env (optional)
  path.join(repoRoot, '.env'),
].filter(Boolean);

// Pick the first that exists
const chosen = candidates.find((p) => fs.existsSync(p));

// Load it (dotenv does NOT override existing process.env by default)
if (chosen) {
  dotenv.config({ path: chosen });
}
if (process.env.ENV_DEBUG === '1') {
  console.log('[loadEnv]', { NODE_ENV: process.env.NODE_ENV, chosen, DATABASE_URL: process.env.DATABASE_URL });
}