#!/usr/bin/env node
import { loadRootDotenvOptional } from '../lib/dotenv-lite.mjs';
import { fetchJson } from '../lib/fetch-json.mjs';
import { assert, exitCode, resetFailed, skip } from '../worker-portal/lib/assert.mjs';
import { bootstrapV2TestState, teardown } from './lib/bootstrap.mjs';

loadRootDotenvOptional();

/**
 * @param {import('./lib/bootstrap.mjs').V2TestState} state
 */
export async function runAuthRouteTests(state) {
  console.log('\n=== V2 Auth routes ===\n');
  const { base } = state;

  const workerLogin = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier: state.worker.email, password: state.worker.password },
  });
  assert(
    workerLogin.ok &&
      workerLogin.data?.accessToken &&
      workerLogin.data?.user?.role === 'worker',
    'POST /auth/login (worker)',
    `${workerLogin.status} role=${workerLogin.data?.user?.role}`,
  );

  const employerLogin = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier: state.employer.email, password: state.employer.password },
  });
  assert(
    employerLogin.ok && employerLogin.data?.user?.role === 'employer',
    'POST /auth/login (employer)',
    `${employerLogin.status}`,
  );

  const me = await fetchJson(base, '/auth/me', {
    bearer: workerLogin.data.accessToken,
  });
  assert(
    me.ok && me.data?.user?.id === state.worker.userId,
    'GET /auth/me',
    `${me.status}`,
  );

  const refresh = await fetchJson(base, '/auth/refresh', {
    method: 'POST',
    body: { refreshToken: workerLogin.data.refreshToken },
  });
  assert(
    refresh.ok && refresh.data?.accessToken,
    'POST /auth/refresh',
    `${refresh.status}`,
  );

  const forgot = await fetchJson(base, '/auth/forgot-password', {
    method: 'POST',
    body: { identifier: state.worker.email },
  });
  assert(forgot.ok && forgot.data?.message, 'POST /auth/forgot-password', `${forgot.status}`);

  const fixedOtp = (process.env.JOBALLA_DEV_FIXED_OTP ?? '').trim();
  if (/^[0-9]{6}$/.test(fixedOtp)) {
    const suffix = `${Date.now()}`;
    const email = `v2-auth-register-${suffix}@example.test`;
    const password = `V2Reg!${suffix.slice(-6)}`;
    const reg = await fetchJson(base, '/auth/register', {
      method: 'POST',
      body: {
        role: 'worker',
        email,
        password,
        preferredLanguage: 'eng',
      },
    });
    assert(reg.ok, 'POST /auth/register', `${reg.status} ${JSON.stringify(reg.data)}`);

    const ver = await fetchJson(base, '/auth/verify', {
      method: 'POST',
      body: {
        identifier: email,
        code: fixedOtp,
        purpose: 'registration',
      },
    });
    assert(
      ver.ok && ver.data?.accessToken && ver.data?.user?.role === 'worker',
      'POST /auth/verify',
      `${ver.status}`,
    );

    const resend = await fetchJson(base, '/auth/resend-otp', {
      method: 'POST',
      body: { identifier: email, purpose: 'registration' },
    });
    assert(resend.ok, 'POST /auth/resend-otp', `${resend.status}`);
  } else {
    skip('POST /auth/register + verify + resend-otp', 'set JOBALLA_DEV_FIXED_OTP in .env');
  }

  const logout = await fetchJson(base, '/auth/logout', {
    method: 'POST',
    bearer: refresh.data?.accessToken ?? workerLogin.data.accessToken,
    body: { refreshToken: workerLogin.data.refreshToken },
  });
  assert(logout.ok && logout.data?.message, 'POST /auth/logout', `${logout.status}`);
}

async function main() {
  resetFailed();
  let state;
  try {
    state = await bootstrapV2TestState();
    await runAuthRouteTests(state);
  } finally {
    await teardown();
  }
  process.exit(exitCode());
}

import { pathToFileURL } from 'url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
