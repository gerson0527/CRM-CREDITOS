import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/credilibranzasjg';

function getConnectionInfo(value: string) {
  try {
    const url = new URL(value);
    return {
      configured: Boolean(process.env.DATABASE_URL),
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username),
    };
  } catch {
    return { configured: Boolean(process.env.DATABASE_URL), invalid: true };
  }
}

const connectionInfo = getConnectionInfo(connectionString);
console.log('[db] PostgreSQL connection target', connectionInfo);

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
  try {
    const res = await pool.query(sql, params);
    return res.rows as T[];
  } catch (error: any) {
    console.error('[db] PostgreSQL query failed', {
      ...connectionInfo,
      code: error?.code,
      message: error?.message,
    });
    throw error;
  }
}

export async function queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}