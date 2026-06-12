#!/usr/bin/env node
/**
 * Admin portal — Reports / disputes (7 routes)
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
export async function runReportsTests(state) {
  console.log('\n=== Reports ===\n');

  const list = await adminFetch(state.base, '/reports?limit=10', {
    bearer: state.token,
  });
  assert(
    list.ok && list.data?.items !== undefined,
    'GET /admin/reports',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const reportId =
    state.reportId ??
    list.data.items.find((i) => i.status === 'open')?.id ??
    list.data.items[0]?.id;

  if (!reportId) {
    skip('Report detail/mutations', 'no reportId');
    return state;
  }

  const detail = await adminFetch(state.base, `/reports/${reportId}`, {
    bearer: state.token,
  });
  assert(
    detail.ok && detail.data?.id === reportId,
    'GET /admin/reports/:reportId',
    `${detail.status} ${JSON.stringify(detail.data)}`,
  );

  const note = await adminFetch(state.base, `/reports/${reportId}/notes`, {
    method: 'POST',
    bearer: state.token,
    body: { note: 'Internal report note from smoke test.' },
  });
  assert(note.ok, 'POST /admin/reports/:reportId/notes', `${note.status}`);

  const escalate = await adminFetch(state.base, `/reports/${reportId}/escalate`, {
    method: 'POST',
    bearer: state.token,
  });
  assert(
    escalate.ok && escalate.data?.status === 'escalated',
    'POST /admin/reports/:reportId/escalate',
    `${escalate.status} ${JSON.stringify(escalate.data)}`,
  );

  const resolve = await adminFetch(state.base, `/reports/${reportId}/resolve`, {
    method: 'POST',
    bearer: state.token,
    body: {
      reason: 'Resolved in smoke test.',
      note: 'Payment verified offline.',
    },
  });
  assert(
    resolve.ok && resolve.data?.status === 'resolved',
    'POST /admin/reports/:reportId/resolve',
    `${resolve.status} ${JSON.stringify(resolve.data)}`,
  );

  const close = await adminFetch(state.base, `/reports/${reportId}/close`, {
    method: 'POST',
    bearer: state.token,
  });
  assert(
    close.ok && close.data?.status === 'closed',
    'POST /admin/reports/:reportId/close',
    `${close.status} ${JSON.stringify(close.data)}`,
  );

  state.reportId = reportId;
  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState();
  await runReportsTests(state);
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
