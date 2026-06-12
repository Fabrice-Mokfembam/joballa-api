#!/usr/bin/env node
/**
 * Admin portal — Analytics (3 routes, super admin)
 */
import { initAdminPortalEnv } from './lib/init.mjs';
import { assert, exitCode, skip } from './lib/assert.mjs';
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
export async function runAnalyticsTests(state) {
  console.log('\n=== Analytics ===\n');

  if (state.role !== 'super_admin') {
    skip('All analytics routes', 'super_admin only');
    return;
  }

  const overview = await adminFetch(state.base, '/analytics/overview', {
    bearer: state.token,
  });
  assert(
    overview.ok && Array.isArray(overview.data?.totals),
    'GET /admin/analytics/overview',
    `${overview.status} ${JSON.stringify(overview.data)}`,
  );

  const depts = await adminFetch(state.base, '/analytics/departments', {
    bearer: state.token,
  });
  assert(
    Array.isArray(depts.data),
    'GET /admin/analytics/departments',
    `${depts.status} ${JSON.stringify(depts.data)}`,
  );

  const earnings = await adminFetch(
    state.base,
    '/analytics/earnings?from=2026-01-01&to=2026-12-31',
    { bearer: state.token },
  );
  assert(
    earnings.ok && Array.isArray(earnings.data?.rows),
    'GET /admin/analytics/earnings',
    `${earnings.status} ${JSON.stringify(earnings.data)}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState({ seedModeration: false });
  await runAnalyticsTests(state);
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
