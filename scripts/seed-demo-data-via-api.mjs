#!/usr/bin/env node
/**
 * Seed demo data through real HTTP routes (worker + employer accounts).
 *
 * Usage (local API on port 8000):
 *   JOBALLA_SEED_USE_LOCAL=1 node scripts/seed-demo-data-via-api.mjs
 *
 * Env overrides:
 *   SEED_WORKER_EMAIL, SEED_EMPLOYER_EMAIL, SEED_PASSWORD, API_URL
 */
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { fetchJson } from './lib/fetch-json.mjs';
import { sampleJobBody } from './employer-portal/lib/bootstrap.mjs';

loadRootDotenvOptional();

const WORKER_EMAIL =
  process.env.SEED_WORKER_EMAIL?.trim() || 'fabricemokfembam@gmail.com';
const EMPLOYER_EMAIL =
  process.env.SEED_EMPLOYER_EMAIL?.trim() || 'fabricekongnyuy2@gmail.com';
const PASSWORD = process.env.SEED_PASSWORD?.trim() || 'Thiago+123';

const base = (
  process.env.API_URL?.trim() ||
  (process.env.JOBALLA_SEED_USE_LOCAL === '1'
    ? `http://127.0.0.1:${process.env.PORT ?? '8000'}`
    : 'https://joballa-api.onrender.com')
).replace(/\/$/, '');

function log(step, detail) {
  console.log(detail ? `${step} — ${detail}` : step);
}

function warn(step, detail) {
  console.warn(`WARN ${step}${detail ? ` — ${detail}` : ''}`);
}

async function login(identifier, password) {
  const res = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier, password },
  });
  if (!res.ok || !res.data?.accessToken) {
    throw new Error(
      `Login failed for ${identifier}: ${res.status} ${JSON.stringify(res.data)}`,
    );
  }
  return {
    token: res.data.accessToken,
    userId: res.data.user?.id,
    role: res.data.user?.role,
  };
}

async function employer(path, token, opts = {}) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return fetchJson(base, `/api/employer${suffix}`, { ...opts, bearer: token });
}

async function worker(path, token, opts = {}) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return fetchJson(base, `/api/worker${suffix}`, { ...opts, bearer: token });
}

async function api(path, token, opts = {}) {
  return fetchJson(base, path, { ...opts, bearer: token });
}

async function seedWorkerProfile(token) {
  log('Worker', 'Enriching profile…');

  const patchCalls = [
    ['/profile/personal-info', {
      firstName: 'Fabrice',
      lastName: 'Mokfembam',
      city: 'Douala',
      region: 'Littoral',
      country: 'Cameroon',
      languages: ['English', 'French'],
      availabilityStatus: 'AVAILABLE',
    }],
    ['/profile/professional-summary', {
      title: 'Domestic & Events Specialist',
      summary:
        'Experienced worker available for domestic, events, and general support roles across Cameroon.',
      industries: ['Domestic', 'Events', 'Hospitality'],
    }],
    ['/profile/skills', {
      skills: [
        'Housekeeping',
        'Cooking',
        'Childcare',
        'Event setup',
        'Customer service',
      ],
    }],
    ['/profile/payment-details', {
      mobileMoneyProvider: 'MTN_MOMO',
      mobileMoneyNumber: '+237670000001',
    }],
  ];

  for (const [path, body] of patchCalls) {
    const r = await worker(path, token, { method: 'PATCH', body });
    if (!r.ok) warn('profile patch', `${path} ${r.status}`);
  }

  const workCompanies = [
    { company: 'Blue Home Services', role: 'Lead Cleaner' },
    { company: 'Douala Events Co', role: 'Event Staff' },
    { company: 'Family Residence Bonapriso', role: 'Domestic Assistant' },
  ];
  for (const w of workCompanies) {
    const r = await worker('/profile/work-history', token, {
      method: 'POST',
      body: {
        ...w,
        startDate: '2021-01-15',
        isCurrent: w.company === 'Blue Home Services',
        description: `Hands-on role at ${w.company}.`,
      },
    });
    if (!r.ok) warn('work-history', JSON.stringify(r.data));
    else log('  + work history', w.company);
  }

  const schools = [
    { school: 'GBHS Buea', degree: 'GCE A Level' },
    { school: 'Professional Training Center Douala', degree: 'Hospitality Certificate' },
    { school: 'Online Safety Academy', degree: 'First Aid Basics' },
  ];
  for (const s of schools) {
    const r = await worker('/profile/education', token, {
      method: 'POST',
      body: {
        ...s,
        startDate: '2016-09-01',
        endDate: '2018-06-30',
      },
    });
    if (!r.ok) warn('education', JSON.stringify(r.data));
    else log('  + education', s.school);
  }

  const certs = [
    { name: 'First Aid', issuer: 'Red Cross Cameroon' },
    { name: 'Food Safety', issuer: 'MINCOMMERCE' },
    { name: 'Childcare Basics', issuer: 'Joballa Training' },
  ];
  for (const c of certs) {
    const r = await worker('/profile/certifications', token, {
      method: 'POST',
      body: { ...c, issueDate: '2024-03-01' },
    });
    if (!r.ok) warn('certification', JSON.stringify(r.data));
    else log('  + certification', c.name);
  }

  const me = await worker('/me', token);
  if (me.ok) {
    log(
      '  profile completeness',
      String(me.data?.workerProfile?.profileCompleteness ?? '?') + '%',
    );
  }
}

async function ensureEmployerJobs(token, minCount = 3) {
  log('Employer', `Ensuring at least ${minCount} live jobs…`);
  const list = await employer('/jobs?limit=50', token);
  const items =
    list.ok && Array.isArray(list.data?.items) ? list.data.items : [];
  const jobIds = [];

  for (const j of items) {
    const jobId = j.jobId ?? j.id;
    if (!jobId) continue;
    if (j.status === 'live' || j.status === 'active') {
      jobIds.push(jobId);
      continue;
    }
    if (j.status === 'draft' || j.status === 'pending_review') {
      const live = await employer(`/jobs/${jobId}/status`, token, {
        method: 'PATCH',
        body: { status: 'live' },
      });
      if (live.ok) {
        jobIds.push(jobId);
        log('  → set live', j.title ?? jobId);
      }
    }
  }

  const titles = [
    'Housekeeper — Bonapriso Residence',
    'Event Setup Assistant — Weekend',
    'Part-time Cook — Family Home',
    'Office Cleaner — Akwa District',
  ];

  let created = 0;
  for (const title of titles) {
    if (jobIds.length >= minCount) break;
    const res = await employer('/jobs', token, {
      method: 'POST',
      body: sampleJobBody({
        title: `${title} (${new Date().toISOString().slice(0, 10)})`,
        city: 'Douala',
      }),
    });
    if (!res.ok || !(res.data?.jobId ?? res.data?.id)) {
      warn('create job', `${res.status} ${JSON.stringify(res.data)}`);
      continue;
    }
    const jobId = res.data.jobId ?? res.data.id;
    const live = await employer(`/jobs/${jobId}/status`, token, {
      method: 'PATCH',
      body: { status: 'live' },
    });
    if (!live.ok) {
      warn('set live', `${live.status} ${JSON.stringify(live.data)}`);
    } else {
      jobIds.push(jobId);
      created++;
      log('  + job (live)', title);
    }
  }

  return jobIds.slice(0, Math.max(minCount, jobIds.length));
}

async function seedWorkerJobActions(token, jobIds) {
  log('Worker', 'Jobs: save, customize, apply, report…');

  for (let i = 0; i < jobIds.length; i++) {
    const jobId = jobIds[i];

    await api(`/api/jobs/${jobId}/save`, token, { method: 'POST' });

    await api(`/api/jobs/${jobId}/application/customize-profile`, token, {
      method: 'POST',
      body: {
        professionalSummary: `Custom pitch for job ${i + 1}.`,
        skills: ['Housekeeping', 'Cooking', 'Reliability'],
      },
    });

    const apply = await api(`/api/jobs/${jobId}/apply`, token, {
      method: 'POST',
      body: { jobSpecificNote: `Application from ${WORKER_EMAIL} seed script.` },
    });
    if (apply.ok) {
      log('  + application', jobId);
    } else if (apply.status === 409) {
      warn('apply', `already applied to ${jobId}`);
    } else {
      warn('apply', `${apply.status} ${JSON.stringify(apply.data)}`);
    }

    if (i < 3) {
      await api(`/api/jobs/${jobId}/report`, token, {
        method: 'POST',
        body: { reason: 'OTHER', description: 'Demo seed report (safe test).' },
      });
    }
  }

  const saved = await api('/api/saved-jobs?limit=20', token);
  if (saved.ok) {
    log('  saved jobs count', String(saved.data?.items?.length ?? saved.data?.total ?? 0));
  }

  const apps = await api('/api/applications?limit=20', token);
  if (apps.ok) {
    log('  applications count', String(apps.data?.items?.length ?? apps.data?.total ?? 0));
  }
}

async function employerHireApplicants(token, maxHire = 3) {
  log('Employer', `Hiring up to ${maxHire} applicants…`);
  const list = await employer('/applicants?status=pending&limit=20', token);
  if (!list.ok || !Array.isArray(list.data?.items)) {
    warn('applicants list', `${list.status}`);
    return;
  }

  let hired = 0;
  for (const item of list.data.items) {
    if (hired >= maxHire) break;
    const applicationId = item.applicationId ?? item.id;
    if (!applicationId) continue;

    const short = await employer(`/applicants/${applicationId}/status`, token, {
      method: 'PATCH',
      body: { status: 'shortlisted' },
    });
    if (!short.ok) {
      warn('shortlist', applicationId);
      continue;
    }

    const hire = await employer(`/applicants/${applicationId}/status`, token, {
      method: 'PATCH',
      body: { status: 'hired' },
    });
    if (hire.ok) {
      hired++;
      log('  + hired', applicationId);
    } else {
      warn('hire', `${hire.status} ${JSON.stringify(hire.data)}`);
    }
  }

  const engagements = await employer('/workforce?limit=20', token);
  if (engagements.ok) {
    const count =
      engagements.data?.items?.length ??
      engagements.data?.workers?.length ??
      engagements.data?.total ??
      0;
    log('  workforce/engagements visible', String(count));
  }
}

async function main() {
  console.log(`Seeding demo data via API → ${base}`);
  console.log(`Worker: ${WORKER_EMAIL}`);
  console.log(`Employer: ${EMPLOYER_EMAIL}\n`);

  const workerAuth = await login(WORKER_EMAIL, PASSWORD);
  if (workerAuth.role !== 'WORKER') {
    throw new Error(`Expected WORKER role, got ${workerAuth.role}`);
  }
  const employerAuth = await login(EMPLOYER_EMAIL, PASSWORD);
  if (employerAuth.role !== 'EMPLOYER') {
    throw new Error(`Expected EMPLOYER role, got ${employerAuth.role}`);
  }

  log('Auth', 'Both logins OK\n');

  await seedWorkerProfile(workerAuth.token);
  console.log('');
  const jobIds = await ensureEmployerJobs(employerAuth.token, 3);
  console.log('');
  await seedWorkerJobActions(workerAuth.token, jobIds);
  console.log('');
  await employerHireApplicants(employerAuth.token, 3);
  console.log('');

  const earnings = await api('/api/earnings/summary', workerAuth.token);
  if (earnings.ok) {
    log('Worker earnings summary', JSON.stringify(earnings.data));
  }

  const workerEng = await api('/api/worker/engagements?limit=10', workerAuth.token);
  if (workerEng.ok) {
    log('Worker engagements', String(workerEng.data?.items?.length ?? 0));
  }

  console.log('\nDone. Check Neon / Prisma Studio for populated tables.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
