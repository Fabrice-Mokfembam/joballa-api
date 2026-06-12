#!/usr/bin/env node
/**
 * Admin portal — Departments (11 routes, super-admin mutations)
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
export async function runDepartmentsTests(state) {
  console.log('\n=== Departments ===\n');

  const list = await adminFetch(state.base, '/departments?limit=20', {
    bearer: state.token,
  });
  assert(
    list.ok && list.data?.items !== undefined,
    'GET /admin/departments',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  if (state.role !== 'super_admin') {
    skip('Department mutations', 'super_admin only');
    return state;
  }

  const suffix = Date.now();
  const create = await adminFetch(state.base, '/departments', {
    method: 'POST',
    bearer: state.token,
    body: {
      name: `Joballa Test Dept ${suffix}`,
      email: `dept-admin-${suffix}@example.test`,
      category: 'domestic',
      password: `DeptAdmin99!${String(suffix).slice(-6)}`,
      sendInvite: false,
    },
  });
  assert(
    create.ok && create.data?.id,
    'POST /admin/departments',
    `${create.status} ${JSON.stringify(create.data)}`,
  );
  const departmentId = create.data.id;
  state.departmentId = departmentId;

  const one = await adminFetch(state.base, `/departments/${departmentId}`, {
    bearer: state.token,
  });
  assert(
    one.ok && one.data?.id === departmentId,
    'GET /admin/departments/:departmentId',
    `${one.status} ${JSON.stringify(one.data)}`,
  );

  const jobs = await adminFetch(
    state.base,
    `/departments/${departmentId}/jobs?limit=5`,
    { bearer: state.token },
  );
  assert(
    jobs.ok && jobs.data?.items !== undefined,
    'GET /admin/departments/:departmentId/jobs',
    `${jobs.status}`,
  );

  const docs = await adminFetch(
    state.base,
    `/departments/${departmentId}/documents?limit=5`,
    { bearer: state.token },
  );
  assert(
    docs.ok && docs.data?.items !== undefined,
    'GET /admin/departments/:departmentId/documents',
    `${docs.status}`,
  );

  const activity = await adminFetch(
    state.base,
    `/departments/${departmentId}/activity`,
    { bearer: state.token },
  );
  assert(
    Array.isArray(activity.data),
    'GET /admin/departments/:departmentId/activity',
    `${activity.status}`,
  );

  const suspend = await adminFetch(
    state.base,
    `/departments/${departmentId}/suspend`,
    { method: 'POST', bearer: state.token },
  );
  assert(suspend.ok, 'POST /admin/departments/:departmentId/suspend', `${suspend.status}`);

  const reactivate = await adminFetch(
    state.base,
    `/departments/${departmentId}/reactivate`,
    { method: 'POST', bearer: state.token },
  );
  assert(
    reactivate.ok,
    'POST /admin/departments/:departmentId/reactivate',
    `${reactivate.status}`,
  );

  const resetPw = await adminFetch(
    state.base,
    `/departments/${departmentId}/reset-password`,
    { method: 'POST', bearer: state.token },
  );
  assert(
    resetPw.ok,
    'POST /admin/departments/:departmentId/reset-password',
    `${resetPw.status}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState({ seedModeration: false });
  await runDepartmentsTests(state);
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
