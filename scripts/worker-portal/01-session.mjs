#!/usr/bin/env node
/**
 * Worker portal — Session (2 routes)
 *   GET /api/worker/me
 *   GET /api/worker/profile
 */
import { initWorkerPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { workerFetch } from './lib/http.mjs';
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
export async function runSessionTests(state) {
  console.log('\n=== Session & profile read ===\n');

  const me = await workerFetch(state.base, '/me', {
    bearer: state.workerToken,
  });
  assert(
    me.ok &&
      me.status === 200 &&
      me.data?.role === 'WORKER' &&
      me.data?.workerProfile?.id,
    'GET /api/worker/me',
    `${me.status} ${JSON.stringify(me.data)}`,
  );

  const profile = await workerFetch(state.base, '/profile', {
    bearer: state.workerToken,
  });
  assert(
    profile.ok &&
      profile.status === 200 &&
      profile.data?.id === state.workerProfileId,
    'GET /api/worker/profile',
    `${profile.status} ${JSON.stringify(profile.data)}`,
  );

  const pub = await workerFetch(
    state.base,
    `/profile/${state.workerProfileId}/public`,
    { bearer: state.workerToken },
  );
  assert(
    pub.ok && pub.data?.id === state.workerProfileId,
    'GET /api/worker/profile/:workerId/public',
    `${pub.status} ${JSON.stringify(pub.data)}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    console.log('Bootstrapping worker account…');
    state = await bootstrapWorkerTestState();
  }
  await runSessionTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
