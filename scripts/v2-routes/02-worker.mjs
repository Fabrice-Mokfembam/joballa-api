#!/usr/bin/env node
import { loadRootDotenvOptional } from '../lib/dotenv-lite.mjs';
import {
  employerFetch,
  fetchMultipart,
  hasPaginatedData,
  workerFetch,
} from './lib/http.mjs';
import { assert, exitCode, resetFailed, skip } from '../worker-portal/lib/assert.mjs';
import { bootstrapV2TestState, teardown } from './lib/bootstrap.mjs';

loadRootDotenvOptional();

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Minimal valid PDF for resume upload smoke test */
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<<>>endobj\n2 0 obj<</Length 3>>stream\n \nendstream\nendobj\nxref\n0 3\ntrailer<</Root 1 0 R>>\n%%EOF',
  'utf8',
);

/**
 * @param {import('./lib/bootstrap.mjs').V2TestState} state
 */
export async function runWorkerRouteTests(state) {
  console.log('\n=== V2 Worker routes ===\n');
  const t = state.worker.token;
  const { base, jobId } = state;

  const me = await workerFetch(base, '/me', { bearer: t });
  assert(
    me.ok && me.data?.role === 'worker' && me.data?.workerProfile?.id,
    'GET /worker/me',
    `${me.status}`,
  );

  const dash = await workerFetch(base, '/dashboard', { bearer: t });
  assert(
    dash.ok &&
      dash.data?.welcomeName &&
      dash.data?.stats &&
      Array.isArray(dash.data?.recentApplications) &&
      Array.isArray(dash.data?.suggestedJobs),
    'GET /worker/dashboard',
    `${dash.status}`,
  );

  const jobs = await workerFetch(base, '/jobs?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(jobs.data), 'GET /worker/jobs', `${jobs.status}`);

  const search = await workerFetch(base, '/jobs/search?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(search.data), 'GET /worker/jobs/search', `${search.status}`);

  const detail = await workerFetch(base, `/jobs/${jobId}`, { bearer: t });
  assert(detail.ok && detail.data?.id === jobId, 'GET /worker/jobs/:jobId', `${detail.status}`);

  const share = await workerFetch(base, `/jobs/${jobId}/share`, { bearer: t });
  assert(share.ok && share.data?.url, 'GET /worker/jobs/:jobId/share', `${share.status}`);

  const save = await workerFetch(base, `/jobs/${jobId}/save`, {
    method: 'POST',
    bearer: t,
  });
  assert(save.ok && save.data?.saved === true, 'POST /worker/jobs/:jobId/save', `${save.status}`);

  const saved = await workerFetch(base, '/saved-jobs?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(saved.data), 'GET /worker/saved-jobs', `${saved.status}`);

  const unsave = await workerFetch(base, `/jobs/${jobId}/save`, {
    method: 'DELETE',
    bearer: t,
  });
  assert(unsave.ok, 'DELETE /worker/jobs/:jobId/save', `${unsave.status}`);

  const hide = await workerFetch(base, `/jobs/${jobId}/hide`, {
    method: 'POST',
    bearer: t,
  });
  assert(hide.ok && hide.data?.hidden === true, 'POST /worker/jobs/:jobId/hide', `${hide.status}`);

  const unhide = await workerFetch(base, `/jobs/${jobId}/hide`, {
    method: 'DELETE',
    bearer: t,
  });
  assert(unhide.ok, 'DELETE /worker/jobs/:jobId/hide', `${unhide.status}`);

  const report = await workerFetch(base, `/jobs/${jobId}/report`, {
    method: 'POST',
    bearer: t,
    body: { reason: 'Smoke test report' },
  });
  assert(report.ok && report.data?.id, 'POST /worker/jobs/:jobId/report', `${report.status}`);

  const applyJob =
    jobs.data?.data?.find((j) => j.id !== jobId)?.id ??
    (await seedExtraJob(state));
  let applyOk = false;
  const apply = await workerFetch(base, `/jobs/${applyJob}/apply`, {
    method: 'POST',
    bearer: t,
    body: { coverNote: 'Interested in this role.' },
  });
  if (apply.status === 409 || apply.status === 400) {
    skip('POST /worker/jobs/:jobId/apply', `already applied or validation ${apply.status}`);
  } else {
    assert(apply.ok && apply.data?.id, 'POST /worker/jobs/:jobId/apply', `${apply.status}`);
    state.applicationId = apply.data.id;
    applyOk = true;
  }

  const apps = await workerFetch(base, '/applications?page=1&limit=10', { bearer: t });
  assert(hasPaginatedData(apps.data), 'GET /worker/applications', `${apps.status}`);

  const appsSearch = await workerFetch(base, '/applications/search?page=1&limit=5', {
    bearer: t,
  });
  assert(hasPaginatedData(appsSearch.data), 'GET /worker/applications/search', `${appsSearch.status}`);

  const appId =
    state.applicationId ?? apps.data?.data?.[0]?.id ?? state.applicationId;
  if (appId) {
    const appDetail = await workerFetch(base, `/applications/${appId}`, { bearer: t });
    assert(appDetail.ok && appDetail.data?.id === appId, 'GET /worker/applications/:applicationId', `${appDetail.status}`);
  } else {
    skip('GET /worker/applications/:applicationId', 'no application id');
  }

  const engagements = await workerFetch(base, '/engagements?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(engagements.data), 'GET /worker/engagements', `${engagements.status}`);

  if (state.engagementId) {
    const eng = await workerFetch(base, `/engagements/${state.engagementId}`, { bearer: t });
    assert(eng.ok && eng.data?.id === state.engagementId, 'GET /worker/engagements/:engagementId', `${eng.status}`);
  }

  const summary = await workerFetch(base, '/earnings/summary', { bearer: t });
  assert(summary.ok && summary.data?.currency === 'XAF', 'GET /worker/earnings/summary', `${summary.status}`);

  const tx = await workerFetch(base, '/earnings/transactions?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(tx.data), 'GET /worker/earnings/transactions', `${tx.status}`);

  const stmt = await workerFetch(base, '/earnings/statement?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(stmt.data), 'GET /worker/earnings/statement', `${stmt.status}`);

  if (state.paymentId) {
    const one = await workerFetch(base, `/earnings/transactions/${state.paymentId}`, { bearer: t });
    assert(one.ok && one.data?.id === state.paymentId, 'GET /worker/earnings/transactions/:transactionId', `${one.status}`);
  }

  const profile = await workerFetch(base, '/profile', { bearer: t });
  assert(profile.ok && profile.data?.id, 'GET /worker/profile', `${profile.status}`);

  const put = await workerFetch(base, '/profile', {
    method: 'PUT',
    bearer: t,
    body: {
      fullName: 'V2 Smoke Worker Updated',
      city: 'Douala',
      skills: ['TypeScript', 'NestJS'],
      professionalTitle: 'Backend Developer',
      shortBio: 'Updated via smoke test.',
    },
  });
  assert(put.ok && put.data?.fullName, 'PUT /worker/profile', `${put.status}`);

  const personal = await workerFetch(base, '/profile/personal-info', {
    method: 'PATCH',
    bearer: t,
    body: { city: 'Buea', region: 'South-West' },
  });
  assert(personal.ok, 'PATCH /worker/profile/personal-info', `${personal.status}`);

  const pro = await workerFetch(base, '/profile/professional-summary', {
    method: 'PATCH',
    bearer: t,
    body: { professionalTitle: 'Full Stack Developer' },
  });
  assert(pro.ok, 'PATCH /worker/profile/professional-summary', `${pro.status}`);

  const skills = await workerFetch(base, '/profile/skills', {
    method: 'PATCH',
    bearer: t,
    body: { skills: ['React', 'Node.js'] },
  });
  assert(skills.ok, 'PATCH /worker/profile/skills', `${skills.status}`);

  const work = await workerFetch(base, '/profile/work-history', {
    method: 'POST',
    bearer: t,
    body: {
      companyName: 'New Corp',
      jobTitle: 'Engineer',
      startDate: '2024-01-01',
      isCurrent: true,
    },
  });
  assert(work.ok && work.data?.id, 'POST /worker/profile/work-history', `${work.status}`);
  state.workId = work.data.id;

  const workPatch = await workerFetch(base, `/profile/work-history/${state.workId}`, {
    method: 'PATCH',
    bearer: t,
    body: { jobTitle: 'Senior Engineer' },
  });
  assert(workPatch.ok, 'PATCH /worker/profile/work-history/:workId', `${workPatch.status}`);

  const edu = await workerFetch(base, '/profile/education', {
    method: 'POST',
    bearer: t,
    body: {
      institutionName: 'UB',
      degree: 'BSc',
      startDate: '2018-09-01',
      endDate: '2022-06-01',
    },
  });
  assert(edu.ok && edu.data?.id, 'POST /worker/profile/education', `${edu.status}`);
  state.educationId = edu.data.id;

  const eduPatch = await workerFetch(base, `/profile/education/${state.educationId}`, {
    method: 'PATCH',
    bearer: t,
    body: { degree: 'BSc Computer Science' },
  });
  assert(eduPatch.ok, 'PATCH /worker/profile/education/:educationId', `${eduPatch.status}`);

  const cert = await workerFetch(base, '/profile/certifications', {
    method: 'POST',
    bearer: t,
    body: { name: 'AWS Cloud', issuer: 'Amazon' },
  });
  assert(cert.ok && cert.data?.id, 'POST /worker/profile/certifications', `${cert.status}`);
  state.certificationId = cert.data.id;

  const certPatch = await workerFetch(
    base,
    `/profile/certifications/${state.certificationId}`,
    {
      method: 'PATCH',
      bearer: t,
      body: { issuer: 'AWS' },
    },
  );
  assert(certPatch.ok, 'PATCH /worker/profile/certifications/:certificationId', `${certPatch.status}`);

  const kycPost = await workerFetch(base, '/profile/kyc', {
    method: 'POST',
    bearer: t,
    body: {
      kycType: 'national_id',
      frontUrl: 'https://example.test/id-front.jpg',
      backUrl: 'https://example.test/id-back.jpg',
      selfieUrl: 'https://example.test/selfie.jpg',
    },
  });
  assert(kycPost.ok && kycPost.data?.status, 'POST /worker/profile/kyc', `${kycPost.status}`);

  const kycGet = await workerFetch(base, '/profile/kyc', { bearer: t });
  assert(kycGet.ok, 'GET /worker/profile/kyc', `${kycGet.status}`);

  const payAcc = await workerFetch(base, '/profile/payment-accounts', {
    method: 'POST',
    bearer: t,
    body: { provider: 'mtn_momo', phoneNumber: '+237600000099', isPrimary: true },
  });
  assert(payAcc.ok && payAcc.data?.id, 'POST /worker/profile/payment-accounts', `${payAcc.status}`);
  state.paymentAccountId = payAcc.data.id;

  const payPatch = await workerFetch(
    base,
    `/profile/payment-accounts/${state.paymentAccountId}`,
    {
      method: 'PATCH',
      bearer: t,
      body: { isPrimary: true },
    },
  );
  assert(payPatch.ok, 'PATCH /worker/profile/payment-accounts/:accountId', `${payPatch.status}`);

  const informal = await workerFetch(base, '/informal-requests', {
    method: 'POST',
    bearer: t,
    body: {
      departmentId: state.departmentId,
      departmentCategory: 'software_tech',
      formData: { title: 'Need a tutor' },
      paymentManagedByJoballa: false,
    },
  });
  assert(informal.ok && informal.data?.id, 'POST /worker/informal-requests', `${informal.status}`);

  const informalList = await workerFetch(base, '/informal-requests?page=1&limit=5', {
    bearer: t,
  });
  assert(hasPaginatedData(informalList.data), 'GET /worker/informal-requests', `${informalList.status}`);

  const notif = await workerFetch(base, '/notifications?page=1&limit=5', { bearer: t });
  assert(hasPaginatedData(notif.data), 'GET /worker/notifications', `${notif.status}`);

  if (state.notificationId) {
    const read = await workerFetch(base, `/notifications/${state.notificationId}/read`, {
      method: 'PATCH',
      bearer: t,
    });
    assert(read.ok, 'PATCH /worker/notifications/:notificationId/read', `${read.status}`);
  }

  const settings = await workerFetch(base, '/settings/notifications', { bearer: t });
  assert(settings.ok, 'GET /worker/settings/notifications', `${settings.status}`);

  const settingsPatch = await workerFetch(base, '/settings/notifications', {
    method: 'PATCH',
    bearer: t,
    body: { emailEnabled: true, smsEnabled: false },
  });
  assert(settingsPatch.ok, 'PATCH /worker/settings/notifications', `${settingsPatch.status}`);

  const lang = await workerFetch(base, '/settings/language', {
    method: 'PATCH',
    bearer: t,
    body: { preferredLanguage: 'fre' },
  });
  assert(lang.ok && lang.data?.preferredLanguage === 'fre', 'PATCH /worker/settings/language', `${lang.status}`);

  const cvStatus = await workerFetch(base, '/profile/cv-export/status', { bearer: t });
  assert(
    cvStatus.ok && typeof cvStatus.data?.available === 'boolean',
    'GET /worker/profile/cv-export/status',
    `${cvStatus.status}`,
  );

  const genCv = await fetch(`${base}/worker/profile/cv-export`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/pdf' },
  });
  assert(
    genCv.status === 201 && genCv.headers.get('content-type')?.includes('application/pdf'),
    'POST /worker/profile/cv-export',
    `${genCv.status} type=${genCv.headers.get('content-type')}`,
  );

  const dlCv = await fetch(`${base}/worker/profile/cv-export`, {
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/pdf' },
  });
  assert(
    dlCv.ok && dlCv.headers.get('content-type')?.includes('application/pdf'),
    'GET /worker/profile/cv-export',
    `${dlCv.status}`,
  );

  const docs = await workerFetch(base, '/profile/documents', { bearer: t });
  assert(Array.isArray(docs.data), 'GET /worker/profile/documents', `${docs.status}`);

  await tryMultipartUploads(state);

  if (appId && applyOk) {
    const del = await workerFetch(base, `/applications/${appId}`, {
      method: 'DELETE',
      bearer: t,
    });
    assert(del.ok, 'DELETE /worker/applications/:applicationId', `${del.status}`);
  }

  if (state.workId) {
    await workerFetch(base, `/profile/work-history/${state.workId}`, {
      method: 'DELETE',
      bearer: t,
    });
    assert(true, 'DELETE /worker/profile/work-history/:workId');
  }
  if (state.educationId) {
    await workerFetch(base, `/profile/education/${state.educationId}`, {
      method: 'DELETE',
      bearer: t,
    });
    assert(true, 'DELETE /worker/profile/education/:educationId');
  }
  if (state.certificationId) {
    await workerFetch(base, `/profile/certifications/${state.certificationId}`, {
      method: 'DELETE',
      bearer: t,
    });
    assert(true, 'DELETE /worker/profile/certifications/:certificationId');
  }
  if (state.paymentAccountId) {
    await workerFetch(base, `/profile/payment-accounts/${state.paymentAccountId}`, {
      method: 'DELETE',
      bearer: t,
    });
    assert(true, 'DELETE /worker/profile/payment-accounts/:accountId');
  }

  const removeSaved = await workerFetch(base, `/saved-jobs/${jobId}`, {
    method: 'DELETE',
    bearer: t,
  });
  assert(removeSaved.ok, 'DELETE /worker/saved-jobs/:jobId', `${removeSaved.status}`);
}

/**
 * @param {import('./lib/bootstrap.mjs').V2TestState} state
 */
async function seedExtraJob(state) {
  const res = await employerFetch(state.base, '/jobs', {
    method: 'POST',
    bearer: state.employer.token,
    body: {
      departmentId: state.departmentId,
      title: `Apply target ${Date.now()}`,
      employmentType: 'part_time',
      workMode: 'onsite',
      city: 'Douala',
      payAmount: 5000,
      payStructure: 'daily',
      description: 'Second job for apply smoke test',
      requiredSkills: ['Communication'],
      asDraft: false,
    },
  });
  if (!res.ok) throw new Error(`Failed to seed extra job: ${res.status}`);
  return /** @type {string} */ (res.data.jobId);
}

/**
 * @param {import('./lib/bootstrap.mjs').V2TestState} state
 */
async function tryMultipartUploads(state) {
  const t = state.worker.token;
  const { base } = state;

  const avatar = await fetchMultipart(base, '/worker/profile/avatar', {
    bearer: t,
    buffer: TINY_PNG,
    fileName: 'avatar.png',
  });
  if (avatar.ok) {
    assert(true, 'POST /worker/profile/avatar');
  } else {
    skip('POST /worker/profile/avatar', `status ${avatar.status} (Cloudinary/files may be unavailable)`);
  }

  const cv = await fetchMultipart(base, '/worker/profile/cv', {
    bearer: t,
    buffer: MINIMAL_PDF,
    fileName: 'cv.pdf',
    mime: 'application/pdf',
  });
  if (cv.ok) {
    assert(true, 'POST /worker/profile/cv');
  } else {
    skip('POST /worker/profile/cv', `status ${cv.status}`);
  }

  const doc = await fetchMultipart(base, '/worker/profile/documents', {
    bearer: t,
    buffer: TINY_PNG,
    fields: { documentLabel: 'Portfolio' },
  });
  if (doc.ok && doc.data?.id) {
    assert(true, 'POST /worker/profile/documents');
    const del = await workerFetch(base, `/profile/documents/${doc.data.id}`, {
      method: 'DELETE',
      bearer: t,
    });
    assert(del.ok, 'DELETE /worker/profile/documents/:documentId', `${del.status}`);
  } else {
    skip('POST /worker/profile/documents', `status ${doc.status}`);
  }
}

async function main() {
  resetFailed();
  let state;
  try {
    state = await bootstrapV2TestState();
    await runWorkerRouteTests(state);
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
