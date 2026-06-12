#!/usr/bin/env node
/**
 * Admin portal — KYC (7 routes)
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
export async function runKycTests(state) {
  console.log('\n=== KYC ===\n');

  const list = await adminFetch(state.base, '/kyc?status=pending&limit=10', {
    bearer: state.token,
  });
  assert(
    list.ok && list.data?.items !== undefined,
    'GET /admin/kyc',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const kycId =
    state.kycId ??
    list.data.items.find((i) => i.status === 'pending')?.id ??
    list.data.items[0]?.id;

  if (!kycId) {
    skip('KYC detail/mutations', 'no kycId');
    return state;
  }

  const detail = await adminFetch(state.base, `/kyc/${kycId}`, {
    bearer: state.token,
  });
  assert(
    detail.ok && detail.data?.id === kycId,
    'GET /admin/kyc/:kycId',
    `${detail.status} ${JSON.stringify(detail.data)}`,
  );

  const note = await adminFetch(state.base, `/kyc/${kycId}/notes`, {
    method: 'POST',
    bearer: state.token,
    body: { note: 'Internal KYC review note from smoke test.' },
  });
  assert(note.ok, 'POST /admin/kyc/:kycId/notes', `${note.status}`);

  const audit = await adminFetch(state.base, `/kyc/${kycId}/audit-log`, {
    bearer: state.token,
  });
  assert(audit.ok, 'GET /admin/kyc/:kycId/audit-log', `${audit.status}`);

  const approve = await adminFetch(state.base, `/kyc/${kycId}/approve`, {
    method: 'POST',
    bearer: state.token,
    body: { note: 'Verified in smoke test.' },
  });
  assert(
    approve.ok && approve.data?.status === 'approved',
    'POST /admin/kyc/:kycId/approve',
    `${approve.status} ${JSON.stringify(approve.data)}`,
  );

  state.kycId = kycId;
  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState();
  await runKycTests(state);
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
