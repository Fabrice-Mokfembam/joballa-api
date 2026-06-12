#!/usr/bin/env node
/**
 * Employer portal — Payments (6 routes)
 *   GET  /api/employer/payments
 *   GET  /api/employer/payments/workers
 *   POST /api/employer/payments/pay
 *   GET  /api/employer/payments/history
 *   GET  /api/employer/payments/:paymentId
 *   GET  /api/employer/payments/statement
 */
import { initEmployerPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { employerFetch } from './lib/http.mjs';
import {
  bootstrapEmployerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';

initEmployerPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').EmployerTestState} state
 */
export async function runPaymentsTests(state) {
  console.log('\n=== Payments ===\n');

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const summary = await employerFetch(
    state.base,
    `/payments?month=${month}&year=${year}`,
    { bearer: state.employerToken },
  );
  assert(
    summary.ok && summary.data?.totalPayroll,
    'GET /api/employer/payments',
    `${summary.status} ${JSON.stringify(summary.data)}`,
  );

  const workers = await employerFetch(
    state.base,
    `/payments/workers?month=${month}&year=${year}`,
    { bearer: state.employerToken },
  );
  assert(
    workers.ok && Array.isArray(workers.data?.items),
    'GET /api/employer/payments/workers',
    `${workers.status} ${JSON.stringify(workers.data)}`,
  );

  if (state.workerProfileId) {
    const pay = await employerFetch(state.base, '/payments/pay', {
      method: 'POST',
      bearer: state.employerToken,
      body: {
        workerId: state.workerProfileId,
        amount: 50000,
        currency: 'XAF',
        provider: 'MoMo',
        phone: '+237650000001',
        period,
      },
    });
    assert(
      pay.ok && pay.data?.paymentId,
      'POST /api/employer/payments/pay',
      `${pay.status} ${JSON.stringify(pay.data)}`,
    );
    state.paymentId = pay.data.paymentId;
  } else {
    console.warn('SKIP — POST /api/employer/payments/pay (no workerProfileId)');
  }

  const history = await employerFetch(state.base, '/payments/history?page=1&limit=10', {
    bearer: state.employerToken,
  });
  assert(
    history.ok && Array.isArray(history.data?.items),
    'GET /api/employer/payments/history',
    `${history.status} ${JSON.stringify(history.data)}`,
  );

  if (state.paymentId) {
    const one = await employerFetch(state.base, `/payments/${state.paymentId}`, {
      bearer: state.employerToken,
    });
    assert(
      one.ok && one.data?.paymentId === state.paymentId,
      'GET /api/employer/payments/:paymentId',
      `${one.status} ${JSON.stringify(one.data)}`,
    );
  }

  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const to = `${year}-${String(month).padStart(2, '0')}-28`;
  const statement = await employerFetch(
    state.base,
    `/payments/statement?from=${from}&to=${to}`,
    { bearer: state.employerToken },
  );
  assert(
    statement.ok && Array.isArray(statement.data?.rows),
    'GET /api/employer/payments/statement',
    `${statement.status} ${JSON.stringify(statement.data)}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapEmployerTestState({ seedApplication: true });
  }
  const { runApplicantsTests } = await import('./04-applicants.mjs');
  await runApplicantsTests(state);
  await runPaymentsTests(state);
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
