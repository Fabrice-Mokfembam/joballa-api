#!/usr/bin/env node
/**
 * Worker portal — Earnings (3 routes)
 *   GET /api/earnings/summary
 *   GET /api/earnings/transactions
 *   GET /api/earnings/statement
 */
import { initWorkerPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { apiFetch } from './lib/http.mjs';
import {
  bootstrapWorkerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';
import { isMain } from './lib/is-main.mjs';

initWorkerPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').WorkerTestState} state
 */
export async function runEarningsTests(state) {
  console.log('\n=== Earnings ===\n');

  const summary = await apiFetch(state.base, '/api/earnings/summary', {
    bearer: state.workerToken,
  });
  assert(
    summary.ok &&
      summary.data &&
      typeof summary.data.totalEarned !== 'undefined',
    'GET /api/earnings/summary',
    `${summary.status} ${JSON.stringify(summary.data)}`,
  );

  const tx = await apiFetch(
    state.base,
    '/api/earnings/transactions?page=1&limit=10',
    { bearer: state.workerToken },
  );
  assert(
    tx.ok && Array.isArray(tx.data?.items),
    'GET /api/earnings/transactions',
    `${tx.status} ${JSON.stringify(tx.data)}`,
  );

  const stmt = await apiFetch(
    state.base,
    '/api/earnings/statement?from=2025-01-01&to=2026-12-31',
    { bearer: state.workerToken },
  );
  assert(
    stmt.ok && Array.isArray(stmt.data),
    'GET /api/earnings/statement',
    `${stmt.status} ${JSON.stringify(stmt.data)}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapWorkerTestState();
  }
  await runEarningsTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
