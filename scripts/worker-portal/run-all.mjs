#!/usr/bin/env node
/**
 * Run all worker portal route tests.
 *
 * Prerequisites
 * - Deployed API (default https://joballa-api.onrender.com) or JOBALLA_WORKER_USE_LOCAL=1
 * - Credentials: JOBALLA_WORKER_IDENTIFIER + JOBALLA_WORKER_PASSWORD, or JOBALLA_WORKER_TOKEN
 * - Or JOBALLA_WORKER_BOOTSTRAP=1 + DATABASE_URL (same DB as API) to seed test data
 *
 * Usage
 *   node scripts/worker-portal/run-all.mjs
 *   npm run smoke:worker
 *
 * Optional env
 *   JOBALLA_TEST_JOB_ID
 *   JOBALLA_TEST_APPLICATION_ID
 *   JOBALLA_TEST_ENGAGEMENT_ID
 */
import { getBaseUrl } from './lib/config.mjs';
import { initWorkerPortalEnv } from './lib/init.mjs';
import { resetFailed, exitCode } from './lib/assert.mjs';
import {
  bootstrapWorkerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';
import { runSessionTests } from './01-session.mjs';
import { runProfileTests } from './02-profile.mjs';
import { runJobsTests } from './03-jobs.mjs';
import { runSavedJobsTests } from './04-saved-jobs.mjs';
import { runApplicationsTests } from './05-applications.mjs';
import { runEarningsTests } from './06-earnings.mjs';
import { runEngagementsTests } from './07-engagements.mjs';
import { runExtraWorkerTests } from './08-extra-routes.mjs';
import { runMay2026RouteTests } from './09-may-2026-routes.mjs';

initWorkerPortalEnv();
resetFailed();

async function main() {
  console.log('Worker portal — full route test suite');
  console.log(`Base URL: ${getBaseUrl()}`);
  console.log('');

  let state = await loadStateFromEnv();
  if (!state) {
    console.log(
      'Bootstrapping worker + employer + ACTIVE job (+ optional engagement)…\n',
    );
    state = await bootstrapWorkerTestState({ seedEngagement: false });
  } else {
    console.log('Using worker credentials from env.\n');
    if (!state.jobId) {
      console.warn(
        'No JOBALLA_TEST_JOB_ID — jobs/saved-jobs/applications may partially skip.',
      );
    }
  }

  await runSessionTests(state);
  state = await runProfileTests(state);
  state = await runJobsTests(state);
  state = await runSavedJobsTests(state);
  state = await runApplicationsTests(state);
  await runEarningsTests(state);
  state = await runEngagementsTests(state);
  await runExtraWorkerTests(state.base, state.workerToken);
  await runMay2026RouteTests(state);

  await teardown();

  console.log('');
  if (exitCode() === 0) {
    console.log('All worker portal checks passed.');
  } else {
    console.error('Some worker portal checks failed.');
  }
  process.exit(exitCode());
}

main().catch(async (err) => {
  console.error(err);
  await teardown();
  process.exit(1);
});
