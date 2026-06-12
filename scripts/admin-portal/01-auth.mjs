#!/usr/bin/env node
/**
 * Admin portal — Auth (7 routes)
 *   POST /admin/auth/login, logout, refresh, forgot-password, reset-password, change-password
 *   GET  /admin/auth/me
 */
import { initAdminPortalEnv } from './lib/init.mjs';
import { assert, exitCode, skip } from './lib/assert.mjs';
import { adminFetch, adminLogin } from './lib/http.mjs';
import {
  bootstrapAdminTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';

initAdminPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').AdminTestState} state
 */
export async function runAuthMeTest(state) {
  const me = await adminFetch(state.base, '/auth/me', {
    bearer: state.token,
  });
  assert(
    me.ok && me.data?.id && me.data?.role && Array.isArray(me.data?.permissions),
    'GET /admin/auth/me',
    `${me.status} ${JSON.stringify(me.data)}`,
  );
}

/**
 * @param {import('./lib/bootstrap.mjs').AdminTestState} state
 */
export async function runAuthTests(state) {
  console.log('\n=== Auth ===\n');

  await runAuthMeTest(state);

  const password =
    state.password ?? process.env.JOBALLA_ADMIN_PASSWORD?.trim() ?? '';

  if (password) {
    const change = await adminFetch(state.base, '/auth/change-password', {
      method: 'POST',
      bearer: state.token,
      body: { currentPassword: password, newPassword: password },
    });
    assert(
      change.ok,
      'POST /admin/auth/change-password',
      `${change.status} ${JSON.stringify(change.data)}`,
    );
  } else {
    skip('POST /admin/auth/change-password', 'no password in state or env');
  }

  const logout = await adminFetch(state.base, '/auth/logout', {
    method: 'POST',
    bearer: state.token,
    jar: state.jar,
  });
  assert(
    logout.ok,
    'POST /admin/auth/logout',
    `${logout.status} ${JSON.stringify(logout.data)}`,
  );

  if (password && state.email) {
    const loginAgain = await adminLogin(
      state.base,
      state.email,
      password,
      state.jar,
    );
    assert(
      loginAgain.ok && loginAgain.data?.accessToken,
      'POST /admin/auth/login (re-login)',
      `${loginAgain.status} ${JSON.stringify(loginAgain.data)}`,
    );
    state.token = loginAgain.data.accessToken;
  }
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    console.log('Bootstrapping super admin…');
    state = await bootstrapAdminTestState({ seedModeration: false });
  }
  await runAuthTests(state);
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
