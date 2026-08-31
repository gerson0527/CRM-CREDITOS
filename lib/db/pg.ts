import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/credilibranzasjg';

declare global {
  var __pgPool: Pool | undefined;
}

const isLocalHost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const sslConfig = isLocalHost ? false : { rejectUnauthorized: false };

export const pool: Pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    ssl: sslConfig,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}