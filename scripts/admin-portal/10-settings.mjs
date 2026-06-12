#!/usr/bin/env node
/**
 * Admin portal — Settings (9 routes, super admin)
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
export async function runSettingsTests(state) {
  console.log('\n=== Settings ===\n');

  if (state.role !== 'super_admin') {
    skip('All settings routes', 'super_admin only');
    return;
  }

  const list = await adminFetch(state.base, '/settings', {
    bearer: state.token,
  });
  assert(
    Array.isArray(list.data),
    'GET /admin/settings',
    `${list.status} ${JSON.stringify(list.data)}`,
  );

  const moderation = await adminFetch(state.base, '/settings/moderation', {
    bearer: state.token,
  });
  assert(moderation.ok, 'GET /admin/settings/moderation', `${moderation.status}`);

  const patchMod = await adminFetch(state.base, '/settings/moderation', {
    method: 'PATCH',
    bearer: state.token,
    body: { autoRejectDuplicates: true },
  });
  assert(patchMod.ok, 'PATCH /admin/settings/moderation', `${patchMod.status}`);

  const docReq = await adminFetch(state.base, '/settings/document-requirements', {
    bearer: state.token,
  });
  assert(docReq.ok, 'GET /admin/settings/document-requirements', `${docReq.status}`);

  const notif = await adminFetch(state.base, '/settings/notifications', {
    bearer: state.token,
  });
  assert(notif.ok, 'GET /admin/settings/notifications', `${notif.status}`);

  const cats = await adminFetch(state.base, '/settings/department-categories', {
    bearer: state.token,
  });
  assert(
    cats.ok,
    'GET /admin/settings/department-categories',
    `${cats.status}`,
  );

  const patchCats = await adminFetch(
    state.base,
    '/settings/department-categories',
    {
      method: 'PATCH',
      bearer: state.token,
      body: {
        categories: [
          'education',
          'tech',
          'domestic',
          'logistics',
          'events',
          'agriculture',
          'construction',
        ],
      },
    },
  );
  assert(
    patchCats.ok,
    'PATCH /admin/settings/department-categories',
    `${patchCats.status}`,
  );
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) state = await bootstrapAdminTestState({ seedModeration: false });
  await runSettingsTests(state);
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
