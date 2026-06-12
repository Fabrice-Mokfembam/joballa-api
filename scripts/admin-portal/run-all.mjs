#!/usr/bin/env node
/**
 * Run all admin portal route tests.
 *
 * Prerequisites
 * - Deployed API (default https://joballa-api.onrender.com) or set API_URL in .env
 * - Either JOBALLA_ADMIN_IDENTIFIER + JOBALLA_ADMIN_PASSWORD for an existing super admin,
 *   or DATABASE_URL + optional JOBALLA_ADMIN_BOOTSTRAP=1 to seed via Prisma (same DB as API)
 *
 * Usage
 *   node scripts/admin-portal/run-all.mjs
 *   npm run smoke:admin
 *
 * Optional env (reuse existing admin)
 *   JOBALLA_ADMIN_TOKEN or JOBALLA_SUPER_ADMIN_TOKEN
 *   JOBALLA_ADMIN_IDENTIFIER + JOBALLA_ADMIN_PASSWORD
 *   JOBALLA_TEST_KYC_ID, JOBALLA_TEST_DOCUMENT_ID, JOBALLA_TEST_JOB_ID, JOBALLA_TEST_REPORT_ID
 */
import { getBaseUrl, isRemoteApi } from './lib/config.mjs';
import { initAdminPortalEnv } from './lib/init.mjs';
import { resetFailed, exitCode } from './lib/assert.mjs';
import {
  bootstrapAdminTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';
import { runAuthMeTest } from './01-auth.mjs';
import { runDashboardTests } from './02-dashboard.mjs';
import { runKycTests } from './03-kyc.mjs';
import { runDocumentsTests } from './04-documents.mjs';
import { runJobsTests } from './05-jobs.mjs';
import { runReportsTests } from './06-reports.mjs';
import { runDepartmentsTests } from './07-departments.mjs';
import { runUsersTests } from './08-users.mjs';
import { runAnalyticsTests } from './09-analytics.mjs';
import { runSettingsTests } from './10-settings.mjs';
import { runAuditLogsTests } from './11-audit-logs.mjs';

initAdminPortalEnv();
resetFailed();

async function main() {
  console.log('Admin portal — full route test suite');
  console.log(`Base URL: ${getBaseUrl()}`);
  console.log('');

  let state = await loadStateFromEnv();
  if (!state) {
    if (isRemoteApi() && process.env.JOBALLA_ADMIN_BOOTSTRAP !== '1') {
      throw new Error(
        'Remote admin tests need credentials: set JOBALLA_ADMIN_IDENTIFIER and ' +
          'JOBALLA_ADMIN_PASSWORD in .env (recommended), or set JOBALLA_ADMIN_BOOTSTRAP=1 ' +
          'with DATABASE_URL to seed a temporary super admin into the same database as the API.',
      );
    }
    console.log('Bootstrapping super admin + moderation fixtures…\n');
    state = await bootstrapAdminTestState({ seedModeration: true });
  } else {
    console.log('Using admin credentials from env.\n');
    if (!state.kycId && !state.jobId) {
      console.warn(
        'No seeded IDs in env — some moderation tests use first list item.',
      );
    }
  }

  console.log('\n=== Auth (session) ===\n');
  await runAuthMeTest(state);
  await runDashboardTests(state);
  state = await runKycTests(state);
  state = await runDocumentsTests(state);
  state = await runJobsTests(state);
  state = await runReportsTests(state);
  state = await runDepartmentsTests(state);
  await runUsersTests(state);
  await runAnalyticsTests(state);
  await runSettingsTests(state);
  await runAuditLogsTests(state);

  await teardown();

  console.log('');
  if (exitCode() === 0) {
    console.log('All admin portal checks passed.');
  } else {
    console.error('Some admin portal checks failed.');
  }
  process.exit(exitCode());
}

main().catch(async (err) => {
  console.error(err);
  await teardown();
  process.exit(1);
});
