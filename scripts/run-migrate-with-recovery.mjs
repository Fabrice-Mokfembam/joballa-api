#!/usr/bin/env node
/**
 * Recover failed admin_accounts_v2 migration (if needed) then run prisma migrate deploy.
 * Uses DIRECT_DB_URL from .env (Neon direct, no pooler).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const FAILED_MIGRATION = '20260605120000_admin_accounts_v2';
const { Client } = pg;

function resolveDirectUrl() {
  const direct = (process.env.DIRECT_DB_URL ?? process.env.DIRECT_URL ?? '').trim();
  if (direct) return direct;

  const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
  if (!databaseUrl) {
    throw new Error('Set DIRECT_DB_URL or DATABASE_URL in .env');
  }

  const parsed = new URL(databaseUrl);
  const host = parsed.hostname.replace(/-pooler(?=\.|$)/i, '');
  parsed.hostname = host;
  let href = parsed.toString();
  if (href.startsWith('postgres:') && !href.startsWith('postgresql:')) {
    href = href.replace(/^postgres:/, 'postgresql:');
  }
  return href;
}

function runPrisma(args) {
  const result = spawnSync('npx', ['prisma', ...args], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const url = resolveDirectUrl();
  const host = new URL(url).hostname;
  console.log(`Database host: ${host}`);

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows: failed } = await client.query(
      `SELECT migration_name, finished_at, rolled_back_at, logs
       FROM _prisma_migrations
       WHERE migration_name = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [FAILED_MIGRATION],
    );

    const failedRow = failed[0];
    const needsRecovery =
      failedRow &&
      failedRow.finished_at === null &&
      failedRow.rolled_back_at === null;

    if (needsRecovery) {
      console.log(`Failed migration detected: ${FAILED_MIGRATION}`);
      const sqlPath = join(
        dirname(fileURLToPath(import.meta.url)),
        'recover-failed-admin-migration.sql',
      );
      const sql = readFileSync(sqlPath, 'utf8');
      console.log('Running recovery SQL...');
      await client.query(sql);
      await client.end();
      console.log('Marking migration as rolled back...');
      runPrisma(['migrate', 'resolve', '--rolled-back', FAILED_MIGRATION]);
    } else if (failedRow?.finished_at) {
      console.log(`${FAILED_MIGRATION} already applied successfully.`);
    } else {
      console.log('No failed admin migration record; skipping recovery.');
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* already closed */
    }
  }

  console.log('Running prisma migrate deploy...');
  runPrisma(['migrate', 'deploy']);
  console.log('Migrations complete.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
