// backend/loadEnv.js (or at project root if you prefer)
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust the path to your real .env location (you said it’s at project root)
dotenv.config({ path: path.join(__dirname, '../.env') });
