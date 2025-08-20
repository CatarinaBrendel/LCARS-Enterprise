// backend/database/db.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 3000, // don't hang forever
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected PG error:', err.message);
});


export async function query(text, params) {
  return pool.query(text, params);
}

export function getClient() {
  return pool.connect();
}

export function endPool() {
  return pool.end();
}
