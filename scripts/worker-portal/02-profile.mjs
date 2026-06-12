#!/usr/bin/env node
/**
 * Worker portal — Profile builder (subset of /api/worker/profile/*)
 */
import { initWorkerPortalEnv } from './lib/init.mjs';
import { assert, exitCode } from './lib/assert.mjs';
import { workerFetch } from './lib/http.mjs';
import {
  bootstrapWorkerTestState,
  loadStateFromEnv,
  teardown,
} from './lib/bootstrap.mjs';
import { isMain } from './lib/is-main.mjs';

initWorkerPortalEnv();

/**
 * @param {import('./lib/bootstrap.mjs').WorkerTestState} state
 */
export async function runProfileTests(state) {
  console.log('\n=== Profile builder ===\n');

  const personal = await workerFetch(state.base, '/profile/personal-info', {
    method: 'PATCH',
    bearer: state.workerToken,
    body: {
      firstName: 'Jean',
      lastName: 'Worker',
      city: 'Buea',
      region: 'South-West',
      languages: ['EN', 'FR'],
      availabilityStatus: 'AVAILABLE',
    },
  });
  assert(
    personal.ok && personal.status === 200,
    'PATCH /api/worker/profile/personal-info',
    `${personal.status} ${JSON.stringify(personal.data)}`,
  );

  const summary = await workerFetch(state.base, '/profile/professional-summary', {
    method: 'PATCH',
    bearer: state.workerToken,
    body: {
      title: 'Housekeeper',
      summary: 'Experienced domestic worker for smoke tests.',
      industries: ['Domestic'],
    },
  });
  assert(
    summary.ok,
    'PATCH /api/worker/profile/professional-summary',
    `${summary.status} ${JSON.stringify(summary.data)}`,
  );

  const skills = await workerFetch(state.base, '/profile/skills', {
    method: 'PATCH',
    bearer: state.workerToken,
    body: { skills: ['cleaning', 'cooking', 'childcare'] },
  });
  assert(
    skills.ok,
    'PATCH /api/worker/profile/skills',
    `${skills.status} ${JSON.stringify(skills.data)}`,
  );

  const work = await workerFetch(state.base, '/profile/work-history', {
    method: 'POST',
    bearer: state.workerToken,
    body: {
      company: 'Home Services Ltd',
      role: 'Cleaner',
      startDate: '2020-03-01',
      isCurrent: true,
    },
  });
  assert(
    work.ok && work.data?.id,
    'POST /api/worker/profile/work-history',
    `${work.status} ${JSON.stringify(work.data)}`,
  );
  state.workHistoryId = work.data.id;

  const workPatch = await workerFetch(
    state.base,
    `/profile/work-history/${state.workHistoryId}`,
    {
      method: 'PATCH',
      bearer: state.workerToken,
      body: { description: 'Updated via worker portal smoke test.' },
    },
  );
  assert(
    workPatch.ok,
    'PATCH /api/worker/profile/work-history/:workId',
    `${workPatch.status} ${JSON.stringify(workPatch.data)}`,
  );

  const edu = await workerFetch(state.base, '/profile/education', {
    method: 'POST',
    bearer: state.workerToken,
    body: {
      school: 'Buea High School',
      degree: 'GCE A Level',
      startDate: '2014-09-01',
      endDate: '2016-06-30',
    },
  });
  assert(
    edu.ok && edu.data?.id,
    'POST /api/worker/profile/education',
    `${edu.status} ${JSON.stringify(edu.data)}`,
  );
  state.educationId = edu.data.id;

  const cert = await workerFetch(state.base, '/profile/certifications', {
    method: 'POST',
    bearer: state.workerToken,
    body: {
      name: 'First Aid',
      issuer: 'Red Cross',
      issueDate: '2023-01-15',
    },
  });
  assert(
    cert.ok && cert.data?.id,
    'POST /api/worker/profile/certifications',
    `${cert.status} ${JSON.stringify(cert.data)}`,
  );
  state.certificationId = cert.data.id;

  const pay = await workerFetch(state.base, '/profile/payment-details', {
    method: 'PATCH',
    bearer: state.workerToken,
    body: {
      mobileMoneyProvider: 'MTN_MOMO',
      mobileMoneyNumber: '+237612345678',
    },
  });
  assert(
    pay.ok,
    'PATCH /api/worker/profile/payment-details',
    `${pay.status} ${JSON.stringify(pay.data)}`,
  );

  const docs = await workerFetch(state.base, '/profile/documents', {
    bearer: state.workerToken,
  });
  assert(
    docs.ok && Array.isArray(docs.data),
    'GET /api/worker/profile/documents',
    `${docs.status} ${JSON.stringify(docs.data)}`,
  );

  const kyc = await workerFetch(state.base, '/profile/kyc', {
    bearer: state.workerToken,
  });
  assert(
    kyc.ok,
    'GET /api/worker/profile/kyc',
    `${kyc.status} ${JSON.stringify(kyc.data)}`,
  );

  const certDel = await workerFetch(
    state.base,
    `/profile/certifications/${state.certificationId}`,
    { method: 'DELETE', bearer: state.workerToken },
  );
  assert(
    certDel.ok || certDel.status === 204,
    'DELETE /api/worker/profile/certifications/:certId',
    `${certDel.status}`,
  );

  const eduDel = await workerFetch(
    state.base,
    `/profile/education/${state.educationId}`,
    { method: 'DELETE', bearer: state.workerToken },
  );
  assert(
    eduDel.ok || eduDel.status === 204,
    'DELETE /api/worker/profile/education/:educationId',
    `${eduDel.status}`,
  );

  const workDel = await workerFetch(
    state.base,
    `/profile/work-history/${state.workHistoryId}`,
    { method: 'DELETE', bearer: state.workerToken },
  );
  assert(
    workDel.ok || workDel.status === 204,
    'DELETE /api/worker/profile/work-history/:workId',
    `${workDel.status}`,
  );

  return state;
}

async function main() {
  let state = await loadStateFromEnv();
  if (!state) {
    state = await bootstrapWorkerTestState();
  }
  await runProfileTests(state);
  await teardown();
  process.exit(exitCode());
}

if (isMain(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
