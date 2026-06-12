#!/usr/bin/env node
/**
 * Admin portal — Documents (7 routes)
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
export async function runDocumentsTests(state) {
  console.log('\n=== Documents ===\n');

  const list = await adminFetch(state.base, '/documents?status=pending&limit=10', {
    bearer: state.token,
  });
  assert(
    list.ok && list.data?.items !== undefined,
    'GET /admin/documents',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const documentId =
    state.documentId ??
    list.data.items.find((i) => i.status === 'pending')?.id ??
    list.data.items[0]?.id;

  if (!documentId) {
    skip('Document detail/mutations', 'no documentId');
    return state;
  }

  const detail = await adminFetch(state.base, `/documents/${documentId}`, {
    bearer: state.token,
  });
  assert(
    detail.ok && detail.data?.id === documentId,
    'GET /admin/documents/:documentId',
    `${detail.status} ${JSON.stringify(detail.data)}`,
  );

  const note = await adminFetch(state.base, `/documents/${documentId}/notes`, {
    method: 'POST',
    bearer: state.token,
    body: { note: 'Document review note from smoke test.' },
  });
  assert(note.ok, 'POST /admin/documents/:documentId/notes', `${note.status}`);

  const audit = await adminFetch(
    state.base,
    `/documents/${documentId}/audit-log`,
    { bearer: state.token },
  );
  assert(audit.ok, 'GET /admin/documents/:documentId/audit-log', `${audit.status}`);

  const approve = await adminFetch(
    state.base,
    `/documents/${documentId}/approve`,
    {
      method: 'POST',
      bearer: state.token,
      body: { note: 'Approved in smoke test.' },
    },
  );
  assert(
    approve.ok && approve.data?.status === 'approved',
    'POST /admin/documents/:documentId/approve',
    `${approve.status} ${JSON.stringify(approve.data)}`,
  );

  state.documentId = documentId;
  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState();
  await runDocumentsTests(state);
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
