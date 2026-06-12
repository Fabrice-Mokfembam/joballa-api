#!/usr/bin/env node
/**
 * Worker portal — Engagements (2 routes)
 *   GET /api/worker/engagements
 *   GET /api/worker/engagements/:engagementId
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
export async function runEngagementsTests(state) {
  console.log('\n=== Engagements ===\n');

  const list = await apiFetch(
    state.base,
    '/api/worker/engagements?page=1&limit=10',
    { bearer: state.workerToken },
  );
  assert(
    list.ok && Array.isArray(list.data?.items),
    'GET /api/worker/engagements',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const engagementId =
    state.engagementId ?? list.data?.items?.[0]?.id ?? null;
  if (!engagementId) {
    skip(
      'GET /api/worker/engagements/:engagementId',
      'no engagement (set JOBALLA_TEST_ENGAGEMENT_ID or JOBALLA_WORKER_BOOTSTRAP=1 with seedEngagement)',
    );
    return state;
  }

  const one = await apiFetch(
    state.base,
    `/api/worker/engagements/${engagementId}`,
    { bearer: state.workerToken },
  );
  assert(
    one.ok && one.data?.id === engagementId,
    'GET /api/worker/engagements/:engagementId',
    `${one.status} ${JSON.stringify(one.data)}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapWorkerTestState({ seedEngagement: true });
  }
  await runEngagementsTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
