#!/usr/bin/env node
/**
 * Worker portal — Saved jobs (3 routes)
 */
import { initWorkerPortalEnv } from './lib/init.mjs';
import { assert, exitCode, skip } from './lib/assert.mjs';
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
export async function runSavedJobsTests(state) {
  console.log('\n=== Saved jobs ===\n');

  if (!state.jobId) {
    skip('saved-jobs', 'no jobId');
    return state;
  }

  await apiFetch(state.base, `/api/jobs/${state.jobId}/save`, {
    method: 'POST',
    bearer: state.workerToken,
  });

  const list = await apiFetch(state.base, '/api/saved-jobs?page=1&limit=10', {
    bearer: state.workerToken,
  });
  assert(
    list.ok && Array.isArray(list.data?.items),
    'GET /api/saved-jobs',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const del = await apiFetch(state.base, `/api/saved-jobs/${state.jobId}`, {
    method: 'DELETE',
    bearer: state.workerToken,
  });
  assert(
    del.ok || del.status === 204,
    'DELETE /api/saved-jobs/:jobId',
    `${del.status}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapWorkerTestState();
  }
  await runSavedJobsTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
