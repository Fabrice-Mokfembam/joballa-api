#!/usr/bin/env node
/**
 * Employer portal — Dashboard (1 route)
 *   GET /api/employer/dashboard
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
export async function runDashboardTests(state) {
  console.log('\n=== Dashboard ===\n');

  const r = await employerFetch(state.base, '/dashboard', {
    bearer: state.employerToken,
  });
  assert(
    r.ok &&
      r.data?.activeJobs &&
      r.data?.totalApplicants &&
      r.data?.hiredWorkers &&
      r.data?.totalPayroll,
    'GET /api/employer/dashboard',
    `${r.status} ${JSON.stringify(r.data)}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapEmployerTestState({ seedApplication: true });
  }
  await runDashboardTests(state);
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
