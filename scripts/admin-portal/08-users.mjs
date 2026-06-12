#!/usr/bin/env node
/**
 * Admin portal — Users (5 routes, super admin)
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
export async function runUsersTests(state) {
  console.log('\n=== Users ===\n');

  if (state.role !== 'super_admin') {
    skip('All user routes', 'super_admin only');
    return state;
  }

  const list = await adminFetch(state.base, '/users?role=worker&limit=10', {
    bearer: state.token,
  });
  assert(
    list.ok && list.data?.items !== undefined,
    'GET /admin/users',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const userId = state.workerUserId ?? list.data.items[0]?.id;
  if (!userId) {
    skip('User detail/mutations', 'no userId');
    return state;
  }

  const detail = await adminFetch(state.base, `/users/${userId}`, {
    bearer: state.token,
  });
  assert(
    detail.ok && detail.data?.id === userId,
    'GET /admin/users/:userId',
    `${detail.status} ${JSON.stringify(detail.data)}`,
  );

  const suspend = await adminFetch(state.base, `/users/${userId}/suspend`, {
    method: 'POST',
    bearer: state.token,
  });
  assert(
    suspend.ok && suspend.data?.status === 'suspended',
    'POST /admin/users/:userId/suspend',
    `${suspend.status} ${JSON.stringify(suspend.data)}`,
  );

  const reactivate = await adminFetch(state.base, `/users/${userId}/reactivate`, {
    method: 'POST',
    bearer: state.token,
  });
  assert(
    reactivate.ok && reactivate.data?.status === 'active',
    'POST /admin/users/:userId/reactivate',
    `${reactivate.status} ${JSON.stringify(reactivate.data)}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState();
  await runUsersTests(state);
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
