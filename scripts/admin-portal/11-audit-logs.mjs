#!/usr/bin/env node
/**
 * Admin portal — Audit logs (2 routes, super admin)
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
export async function runAuditLogsTests(state) {
  console.log('\n=== Audit logs ===\n');

  if (state.role !== 'super_admin') {
    skip('All audit log routes', 'super_admin only');
    return;
  }

  const list = await adminFetch(state.base, '/audit-logs?limit=10', {
    bearer: state.token,
  });
  assert(
    list.ok && list.data?.items !== undefined,
    'GET /admin/audit-logs',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const auditLogId = list.data.items[0]?.id;
  if (!auditLogId) {
    skip('GET /admin/audit-logs/:auditLogId', 'empty audit log list');
    return;
  }

  const one = await adminFetch(state.base, `/audit-logs/${auditLogId}`, {
    bearer: state.token,
  });
  assert(
    one.ok && one.data?.id === auditLogId,
    'GET /admin/audit-logs/:auditLogId',
    `${one.status} ${JSON.stringify(one.data)}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState();
  await runAuditLogsTests(state);
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
