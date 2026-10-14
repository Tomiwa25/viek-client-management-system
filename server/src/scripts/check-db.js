import pg from 'pg';
import { loadEnv } from '../config/env.js';
const { DATABASE_URL } = loadEnv();
if (!DATABASE_URL) { console.error('DATABASE_URL is required for db:check'); process.exit(1); }
const pool = new pg.Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 5000 });
try { const result = await pool.query('SELECT 1 AS connected'); console.log('PostgreSQL connection:', result.rows[0].connected === 1 ? 'OK' : 'FAILED'); } catch (error) { console.error('PostgreSQL connection failed:', error.message); process.exitCode = 1; } finally { await pool.end(); }
