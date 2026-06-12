#!/usr/bin/env node
/**
 * Employer portal — Session & identity (1 route)
 *   GET /api/employer/me
 */
import { initEmployerPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { employerFetch } from './lib/http.mjs';
import {
  bootstrapEmployerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';

initEmployerPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').EmployerTestState} state
 */
export async function runSessionTests(state) {
  console.log('\n=== Session & identity ===\n');

  const r = await employerFetch(state.base, '/me', {
    bearer: state.employerToken,
  });
  assert(
    r.ok &&
      r.status === 200 &&
      r.data?.id &&
      r.data?.company?.name &&
      r.data?.roles === 'employer',
    'GET /api/employer/me',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    console.log('Bootstrapping new employer account…');
    state = await bootstrapEmployerTestState({ seedApplication: false });
  }
  await runSessionTests(state);
  await teardown();
  process.exit(exitCode());
}

import { isMain } from './lib/is-main.mjs';

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
