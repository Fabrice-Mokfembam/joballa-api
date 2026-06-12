#!/usr/bin/env node
/**
 * Run all employer portal route tests by functionality (30 routes).
 *
 * Prerequisites
 * - Deployed API (default https://joballa-api.onrender.com) or JOBALLA_EMPLOYER_USE_LOCAL=1
 * - Credentials: JOBALLA_EMPLOYER_IDENTIFIER + JOBALLA_EMPLOYER_PASSWORD, or JOBALLA_EMPLOYER_TOKEN
 * - Or JOBALLA_EMPLOYER_BOOTSTRAP=1 + DATABASE_URL (same DB as API) to seed test data
 *
 * Usage
 *   node scripts/employer-portal/run-all.mjs
 *   npm run smoke:employer
 *
 * Optional env (reuse existing employer instead of bootstrap)
 *   JOBALLA_EMPLOYER_TOKEN or JOBALLA_ACCESS_TOKEN
 *   JOBALLA_TEST_JOB_ID
 *   JOBALLA_TEST_APPLICATION_ID
 *   JOBALLA_TEST_WORKER_PROFILE_ID
 *   SKIP_LOGO_UPLOAD=1
 */
import { getBaseUrl } from './lib/config.mjs';
import { initEmployerPortalEnv } from './lib/init.mjs';
import { resetFailed, exitCode } from './lib/assert.mjs';
import {
  bootstrapEmployerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';
import { runSessionTests } from './01-session.mjs';
import { runDashboardTests } from './02-dashboard.mjs';
import { runJobsTests } from './03-jobs.mjs';
import { runApplicantsTests } from './04-applicants.mjs';
import { runWorkforceTests } from './05-workforce.mjs';
import { runPaymentsTests } from './06-payments.mjs';
import { runCompanyTests } from './07-company.mjs';

initEmployerPortalEnv();
resetFailed();

async function main() {
  console.log('Employer portal — full route test suite');
  console.log(`Base URL: ${getBaseUrl()}`);
  console.log('');

  let state = await loadStateFromEnv();
  if (!state) {
    console.log('Bootstrapping employer + worker + seeded application…\n');
    state = await bootstrapEmployerTestState({ seedApplication: true });
  } else {
    console.log('Using employer credentials from env.\n');
    if (!state.applicationId) {
      console.warn(
        'No JOBALLA_TEST_APPLICATION_ID — applicants/workforce/payments may partially skip.',
      );
    }
  }

  await runSessionTests(state);
  await runDashboardTests(state);
  state = await runJobsTests(state);
  state = await runApplicantsTests(state);
  state = await runWorkforceTests(state);
  state = await runPaymentsTests(state);
  await runCompanyTests(state);

  await teardown();

  console.log('');
  if (exitCode() === 0) {
    console.log('All employer portal checks passed.');
  } else {
    console.error('Some employer portal checks failed.');
  }
  process.exit(exitCode());
}

main().catch(async (err) => {
  console.error(err);
  await teardown();
  process.exit(1);
});
