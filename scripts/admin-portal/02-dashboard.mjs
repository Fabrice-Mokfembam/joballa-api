#!/usr/bin/env node
/**
 * Admin portal — Dashboard (1 + optional preview lists)
 *   GET /admin/dashboard
 *   GET /admin/kyc?status=pending&limit=3
 *   GET /admin/documents?unresolved=true&limit=3
 *   GET /admin/jobs?moderationQueue=true&limit=3
 */
import { initAdminPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { adminFetch } from './lib/http.mjs';
import {
  bootstrapAdminTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';

initAdminPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').AdminTestState} state
 */
export async function runDashboardTests(state) {
  console.log('\n=== Dashboard ===\n');

  const dash = await adminFetch(state.base, '/dashboard', {
    bearer: state.token,
  });
  assert(
    dash.ok &&
      Array.isArray(dash.data?.stats) &&
      Array.isArray(dash.data?.kycSubmissions),
    'GET /admin/dashboard',
    `${dash.status} ${JSON.stringify(dash.data)}`,
  );

  const kyc = await adminFetch(
    state.base,
    '/kyc?status=pending&limit=3',
    { bearer: state.token },
  );
  assert(
    kyc.ok && kyc.data?.items !== undefined,
    'GET /admin/kyc?status=pending&limit=3',
    `${kyc.status} ${JSON.stringify(kyc.data)}`,
  );

  const docs = await adminFetch(
    state.base,
    '/documents?unresolved=true&limit=3',
    { bearer: state.token },
  );
  assert(
    docs.ok && docs.data?.items !== undefined,
    'GET /admin/documents?unresolved=true&limit=3',
    `${docs.status} ${JSON.stringify(docs.data)}`,
  );

  const jobs = await adminFetch(
    state.base,
    '/jobs?moderationQueue=true&limit=3',
    { bearer: state.token },
  );
  assert(
    jobs.ok && jobs.data?.items !== undefined,
    'GET /admin/jobs?moderationQueue=true&limit=3',
    `${jobs.status} ${JSON.stringify(jobs.data)}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState();
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
