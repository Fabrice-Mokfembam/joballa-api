import { Pool, type PoolConfig } from 'pg';

function isNeonHost(url: string): boolean {
  return /neon\.tech/i.test(url);
}

function isPoolerUrl(url: string): boolean {
  return /-pooler[./]/i.test(url) || /[?&]pgbouncer=true/i.test(url);
}

/** Add Neon/PgBouncer query params when missing. */
export function normalizeDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (isPoolerUrl(url) && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    if (isNeonHost(url) && !parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '30');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Runtime URL for Nest / PrismaService.
 * - Production (Render): pooled DATABASE_URL
 * - Local dev: DIRECT_DB_URL when set (avoids pooler drops with adapter-pg)
 */
export function resolveRuntimeDatabaseUrl(): string {
  const pooled = process.env.DATABASE_URL?.trim() ?? '';
  const direct = (
    process.env.DIRECT_DB_URL ??
    process.env.DIRECT_URL ??
    ''
  ).trim();

  if (process.env.NODE_ENV !== 'production' && direct) {
    return normalizeDatabaseUrl(direct);
  }
  if (pooled) {
    return normalizeDatabaseUrl(pooled);
  }
  if (direct) {
    return normalizeDatabaseUrl(direct);
  }
  throw new Error(
    'DATABASE_URL is not set. For local Neon dev, also set DIRECT_DB_URL (non-pooler host).',
  );
}

export function createPgPool(connectionString: string): Pool {
  const config: PoolConfig = {
    connectionString,
    max: process.env.NODE_ENV === 'production' ? 10 : 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 30_000,
  };

  if (isNeonHost(connectionString) && !/sslmode=/i.test(connectionString)) {
    config.ssl = { rejectUnauthorized: true };
  }

  const pool = new Pool(config);
  pool.on('error', (err) => {
    // Neon may terminate idle pooler connections; log without crashing the process.
    console.error('[pg-pool]', err.message);
  });
  return pool;
}
