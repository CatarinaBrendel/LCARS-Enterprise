// backend/loadEnv.js
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.resolve(__dirname, '.');   // /usr/src/app/backend
const repoRoot    = path.resolve(__dirname, '..');  // /usr/src/app

// 1) Load default .env IF vars aren't already set (override: false)
config({ override: false });

const isTest = process.env.NODE_ENV === 'test';
const candidates = [
  isTest ? path.join(backendRoot, '.env.test') : null,
  path.join(backendRoot, '.env'),
  path.join(repoRoot, '.env'),
].filter(Boolean).filter(p => fs.existsSync(p));

// 2) Load the first existing env file WITHOUT overriding existing env
if (candidates.length) {
  config({ path: candidates[0], override: false });
}

// Optional debug
if (process.env.ENV_DEBUG === '1') {
  const masked = (process.env.DATABASE_URL || '').replace(/\/\/.*@/, '//***@');
  console.log('[loadEnv]', { NODE_ENV: process.env.NODE_ENV, chosen: candidates[0], DATABASE_URL: masked });
}
