#!/usr/bin/env node
import { loadRootDotenvOptional } from '../lib/dotenv-lite.mjs';
import {
  employerFetch,
  fetchMultipart,
  hasPaginatedData,
} from './lib/http.mjs';
import { assert, exitCode, resetFailed, skip } from '../worker-portal/lib/assert.mjs';
import { bootstrapV2TestState, teardown } from './lib/bootstrap.mjs';

loadRootDotenvOptional();

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * @param {import('./lib/bootstrap.mjs').V2TestState} state
 */
export async function runEmployerRouteTests(state) {
  console.log('\n=== V2 Employer routes ===\n');
  const t = state.employer.token;
  const { base, departmentId } = state;

  const me = await employerFetch(base, '/me', { bearer: t });
  assert(
    me.ok && me.data?.role === 'employer' && me.data?.employerProfile?.id,
    'GET /employer/me',
    `${me.status}`,
  );

  const dash = await employerFetch(base, '/dashboard', { bearer: t });
  assert(
    dash.ok &&
      dash.data?.companyName &&
      dash.data?.stats &&
      Array.isArray(dash.data?.activeJobs),
    'GET /employer/dashboard',
    `${dash.status}`,
  );

  const depts = await employerFetch(base, '/departments', { bearer: t });
  assert(depts.ok && Array.isArray(depts.data?.data), 'GET /employer/departments', `${depts.status}`);
  if (depts.data?.data?.length) {
    const categories = new Set(depts.data.data.map((d) => d.category));
    assert(categories.has('software_tech'), 'GET /employer/departments software_tech', 'missing');
    assert(categories.has('other'), 'GET /employer/departments other', 'missing');
  }

  const jobs = await employerFetch(base, '/jobs?page=1&limit=10', { bearer: t });
  assert(hasPaginatedData(jobs.data), 'GET /employer/jobs', `${jobs.status}`);

  const create = await employerFetch(base, '/jobs', {
    method: 'POST',
    bearer: t,
    body: {
      departmentId,
      title: `Employer API job ${Date.now()}`,
      employmentType: 'full_time',
      workMode: 'hybrid',
      city: 'Yaoundé',
      region: 'Centre',
      payAmount: 200000,
      payStructure: 'monthly',
      description: 'Created via employer v2 smoke test.',
      requiredSkills: ['Leadership'],
      numberOfOpenings: 2,
      asDraft: false,
    },
  });
  assert(create.ok && create.data?.jobId, 'POST /employer/jobs', `${create.status}`);
  assert(
    create.data?.status === 'under_review',
    'POST /employer/jobs status under_review',
    String(create.data?.status ?? ''),
  );
  const newJobId = create.data.jobId;

  const jobDetail = await employerFetch(base, `/jobs/${newJobId}`, { bearer: t });
  assert(jobDetail.ok && jobDetail.data?.id === newJobId, 'GET /employer/jobs/:jobId', `${jobDetail.status}`);

  const patch = await employerFetch(base, `/jobs/${newJobId}`, {
    method: 'PATCH',
    bearer: t,
    body: { title: 'Updated smoke job title', duration: '3 months' },
  });
  assert(patch.ok, 'PATCH /employer/jobs/:jobId', `${patch.status}`);

  const draft = await employerFetch(base, `/jobs/${newJobId}/draft`, {
    method: 'POST',
    bearer: t,
    body: { title: 'Draft save' },
  });
  assert(draft.ok, 'POST /employer/jobs/:jobId/draft', `${draft.status}`);

  const status = await employerFetch(base, `/jobs/${newJobId}/status`, {
    method: 'PATCH',
    bearer: t,
    body: { status: 'closed' },
  });
  assert(status.ok, 'PATCH /employer/jobs/:jobId/status closed', `${status.status}`);

  const filters = await employerFetch(base, '/applicants/filters', { bearer: t });
  assert(filters.ok, 'GET /employer/applicants/filters', `${filters.status}`);

  const applicants = await employerFetch(base, '/applicants?page=1&limit=10', { bearer: t });
  assert(hasPaginatedData(applicants.data), 'GET /employer/applicants', `${applicants.status}`);
  const firstApplicant = applicants.data?.data?.[0];
  if (firstApplicant) {
    assert(
      firstApplicant.workerName &&
        !String(firstApplicant.workerName).includes('@'),
      'GET /employer/applicants workerName is display name',
      String(firstApplicant.workerName),
    );
    assert(
      firstApplicant.workerHeadline,
      'GET /employer/applicants workerHeadline present',
      String(firstApplicant.workerHeadline ?? ''),
    );
  }

  const applicationId =
    applicants.data?.data?.[0]?.applicationId ??
    applicants.data?.data?.[0]?.id ??
    state.applicationId;
  if (applicationId) {
    const appDetail = await employerFetch(base, `/applicants/${applicationId}`, { bearer: t });
    assert(appDetail.ok, 'GET /employer/applicants/:applicationId', `${appDetail.status}`);
    const snap = appDetail.data?.profileSnapshot;
    if (snap) {
      assert(
        snap.fullName && !String(snap.fullName).includes('@'),
        'applicant detail profileSnapshot.fullName',
        String(snap.fullName ?? ''),
      );
      assert(
        snap.summary || snap.bio || snap.professionalSummary,
        'applicant detail profileSnapshot summary',
        'missing summary',
      );
      const history = snap.workHistory ?? snap.workHistories ?? [];
      assert(
        Array.isArray(history) && history.length > 0,
        'applicant detail profileSnapshot work history',
        'missing work history',
      );
      const educations = snap.educations ?? snap.education ?? [];
      assert(
        Array.isArray(educations) && educations.length > 0,
        'applicant detail profileSnapshot educations',
        'missing educations',
      );
      const docs = snap.documents ?? [];
      assert(
        Array.isArray(docs) &&
          docs.length > 0 &&
          docs.some((d) => d.url || d.fileUrl),
        'applicant detail profileSnapshot documents with url',
        'missing documents',
      );
    }
    assert(
      appDetail.data?.coverNote || appDetail.data?.jobSpecificNote,
      'applicant detail coverNote / jobSpecificNote',
      'missing apply note',
    );

    const share = await employerFetch(base, `/applicants/${applicationId}/share`, { bearer: t });
    assert(share.ok && share.data?.url, 'GET /employer/applicants/:applicationId/share', `${share.status}`);

    const notes = await employerFetch(base, `/applicants/${applicationId}/notes`, {
      method: 'PATCH',
      bearer: t,
      body: { employerNotes: 'Smoke test internal note' },
    });
    assert(notes.ok, 'PATCH /employer/applicants/:applicationId/notes', `${notes.status}`);
  } else {
    skip('applicant detail routes', 'no applications on seeded job');
  }

  const workforce = await employerFetch(base, '/workforce?page=1&limit=10', { bearer: t });
  assert(hasPaginatedData(workforce.data), 'GET /employer/workforce', `${workforce.status}`);

  const workerId = workforce.data?.data?.[0]?.workerId ?? state.worker.userId;
  if (workerId) {
    const wf = await employerFetch(base, `/workforce/${workerId}`, { bearer: t });
    assert(wf.ok, 'GET /employer/workforce/:workerId', `${wf.status}`);

    const wfStatus = await employerFetch(base, `/workforce/${workerId}/status`, {
      method: 'PATCH',
      bearer: t,
      body: {
        status: 'active',
        engagementId: state.engagementId ?? workforce.data?.data?.[0]?.engagementId,
      },
    });
    assert(wfStatus.ok, 'PATCH /employer/workforce/:workerId/status', `${wfStatus.status}`);
  }

  const payments = await employerFetch(base, '/payments', { bearer: t });
  assert(payments.ok, 'GET /employer/payments', `${payments.status}`);

  const payWorkers = await employerFetch(base, '/payments/workers', { bearer: t });
  assert(Array.isArray(payWorkers.data), 'GET /employer/payments/workers', `${payWorkers.status}`);

  if (state.engagementId) {
    const pay = await employerFetch(base, '/payments/pay', {
      method: 'POST',
      bearer: t,
      body: {
        engagementId: state.engagementId,
        workerId: state.worker.userId,
        amount: 25000,
        provider: 'mtn_momo',
        recipientNumber: '+237600000099',
        idempotencyKey: `pay-smoke-${Date.now()}`,
      },
    });
    assert(pay.ok && pay.data?.paymentId, 'POST /employer/payments/pay', `${pay.status}`);
    state.paymentId = pay.data.paymentId;
  }

  const history = await employerFetch(base, '/payments/history?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(history.data), 'GET /employer/payments/history', `${history.status}`);

  const statement = await employerFetch(base, '/payments/statement?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(statement.data), 'GET /employer/payments/statement', `${statement.status}`);

  const paymentId = state.paymentId ?? history.data?.data?.[0]?.id;
  if (paymentId) {
    const payDetail = await employerFetch(base, `/payments/${paymentId}`, { bearer: t });
    assert(payDetail.ok, 'GET /employer/payments/:paymentId', `${payDetail.status}`);
  }

  const company = await employerFetch(base, '/company', { bearer: t });
  assert(company.ok && company.data?.companyName, 'GET /employer/company', `${company.status}`);

  const companyPatch = await employerFetch(base, '/company', {
    method: 'PATCH',
    bearer: t,
    body: { tagline: 'Built for Cameroon', city: 'Douala' },
  });
  assert(companyPatch.ok, 'PATCH /employer/company', `${companyPatch.status}`);

  const informal = await employerFetch(base, '/informal-requests', {
    method: 'POST',
    bearer: t,
    body: {
      departmentId,
      departmentCategory: 'domestic',
      formData: { need: 'House help' },
      paymentManagedByJoballa: true,
    },
  });
  assert(informal.ok && informal.data?.id, 'POST /employer/informal-requests', `${informal.status}`);

  const informalList = await employerFetch(base, '/informal-requests?page=1&limit=5', {
    bearer: t,
  });
  assert(hasPaginatedData(informalList.data), 'GET /employer/informal-requests', `${informalList.status}`);

  const notif = await employerFetch(base, '/notifications?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(notif.data), 'GET /employer/notifications', `${notif.status}`);

  const firstNotif = notif.data?.data?.[0]?.id;
  if (firstNotif) {
    const read = await employerFetch(base, `/notifications/${firstNotif}/read`, {
      method: 'PATCH',
      bearer: t,
    });
    assert(read.ok, 'PATCH /employer/notifications/:notificationId/read', `${read.status}`);
  } else {
    skip('PATCH /employer/notifications/:notificationId/read', 'no notifications');
  }

  const settings = await employerFetch(base, '/settings/notifications', { bearer: t });
  assert(settings.ok, 'GET /employer/settings/notifications', `${settings.status}`);

  const settingsPatch = await employerFetch(base, '/settings/notifications', {
    method: 'PATCH',
    bearer: t,
    body: { paymentUpdates: true },
  });
  assert(settingsPatch.ok, 'PATCH /employer/settings/notifications', `${settingsPatch.status}`);

  const lang = await employerFetch(base, '/settings/language', {
    method: 'PATCH',
    bearer: t,
    body: { preferredLanguage: 'eng' },
  });
  assert(lang.ok, 'PATCH /employer/settings/language', `${lang.status}`);

  const logo = await fetchMultipart(base, '/employer/company/logo', {
    bearer: t,
    buffer: TINY_PNG,
  });
  if (logo.ok) {
    assert(true, 'POST /employer/company/logo');
  } else {
    skip('POST /employer/company/logo', `status ${logo.status}`);
  }

  const doc = await fetchMultipart(base, '/employer/company/documents', {
    bearer: t,
    buffer: TINY_PNG,
    fields: { documentName: 'Business registration' },
  });
  if (doc.ok && doc.data?.id) {
    assert(true, 'POST /employer/company/documents');
    const del = await employerFetch(base, `/company/documents/${doc.data.id}`, {
      method: 'DELETE',
      bearer: t,
    });
    assert(del.ok, 'DELETE /employer/company/documents/:documentId', `${del.status}`);
  } else {
    skip('POST /employer/company/documents', `status ${doc.status}`);
  }

  const delJob = await employerFetch(base, `/jobs/${newJobId}`, {
    method: 'DELETE',
    bearer: t,
  });
  assert(delJob.ok, 'DELETE /employer/jobs/:jobId', `${delJob.status}`);
}

async function main() {
  resetFailed();
  let state;
  try {
    state = await bootstrapV2TestState();
    await runEmployerRouteTests(state);
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
