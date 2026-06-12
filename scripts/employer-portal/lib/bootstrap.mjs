import bcrypt from 'bcrypt';
import { fetchJson } from '../../lib/fetch-json.mjs';
import { getBaseUrl, isRemoteApi } from './config.mjs';
import { getPrisma, disconnectPrisma } from './prisma.mjs';

const BCRYPT_ROUNDS = 12;

/**
 * @typedef {object} EmployerTestState
 * @property {string} base
 * @property {string} employerToken
 * @property {string} employerUserId
 * @property {string} employerProfileId
 * @property {string} employerEmail
 * @property {string} workerToken
 * @property {string} workerUserId
 * @property {string} workerProfileId
 * @property {string} [jobId]
 * @property {string} [applicationId]
 * @property {string} [shiftId]
 * @property {string} [paymentId]
 * @property {Record<string, string>} jar
 */

/**
 * @param {object} [opts]
 * @param {boolean} [opts.seedApplication] — activate job + create application row
 */
/**
 * Seed employer + worker + job + application via Prisma (same DB as API).
 * Used for deployed API smokes when register/OTP is not available.
 */
export async function bootstrapEmployerViaPrisma(opts = {}) {
  const base = getBaseUrl();
  const prisma = getPrisma();
  const suffix = `${Date.now()}`;
  const password = `EmployerTest99!${suffix.slice(-6)}`;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const employerEmail = `employer-smoke-${suffix}@example.test`;
  const workerEmail = `worker-smoke-${suffix}@example.test`;

  const employerUser = await prisma.user.create({
    data: {
      email: employerEmail,
      passwordHash,
      role: 'EMPLOYER',
      verificationStatus: 'VERIFIED',
      isActive: true,
      languagePreference: 'EN',
    },
  });

  const employerProfile = await prisma.employerProfile.create({
    data: {
      userId: employerUser.id,
      companyName: `Smoke Test Employer ${suffix}`,
      verificationStatus: 'VERIFIED',
    },
  });

  const workerUser = await prisma.user.create({
    data: {
      email: workerEmail,
      passwordHash,
      role: 'WORKER',
      verificationStatus: 'VERIFIED',
      isActive: true,
      languagePreference: 'EN',
    },
  });

  const workerProfile = await prisma.workerProfile.create({
    data: {
      userId: workerUser.id,
      fullName: 'Smoke Test Worker',
      preferredJobCategories: [],
      languagesSpoken: ['EN'],
      skills: ['React', 'Communication'],
      city: 'Douala',
    },
  });

  const login = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier: employerEmail, password },
  });
  if (!login.ok || !login.data?.accessToken) {
    throw new Error(
      `Employer login failed: ${login.status} ${JSON.stringify(login.data)}`,
    );
  }
  if (login.data.user?.role !== 'EMPLOYER') {
    throw new Error('Expected EMPLOYER role after login.');
  }

  /** @type {EmployerTestState} */
  const state = {
    base,
    employerToken: login.data.accessToken,
    employerUserId: employerUser.id,
    employerProfileId: employerProfile.id,
    employerEmail,
    workerToken: '',
    workerUserId: workerUser.id,
    workerProfileId: workerProfile.id,
    jar: {},
  };

  if (opts.seedApplication !== false) {
    const jobRes = await fetchJson(base, '/api/employer/jobs', {
      method: 'POST',
      bearer: state.employerToken,
      body: sampleJobBody(),
    });
    if (!jobRes.ok || !jobRes.data?.jobId) {
      throw new Error(
        `bootstrap job create failed: ${jobRes.status} ${JSON.stringify(jobRes.data)}`,
      );
    }
    state.jobId = jobRes.data.jobId;

    await prisma.job.update({
      where: { id: state.jobId },
      data: { status: 'ACTIVE' },
    });

    const application = await prisma.application.create({
      data: {
        jobId: state.jobId,
        workerId: state.workerProfileId,
        profileSnapshot: {
          fullName: workerProfile.fullName,
          city: workerProfile.city ?? 'Douala',
          skills: workerProfile.skills,
          verificationStatus: 'VERIFIED',
        },
        jobSpecificNote: 'Employer portal production smoke test',
        status: 'SUBMITTED',
      },
    });
    state.applicationId = application.id;
  }

  return state;
}

export async function bootstrapEmployerTestState(opts = {}) {
  const base = getBaseUrl();

  if (isRemoteApi(base)) {
    if (process.env.JOBALLA_EMPLOYER_BOOTSTRAP === '1') {
      try {
        return await bootstrapEmployerViaPrisma(opts);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Prisma bootstrap failed (${msg}); trying register/verify flow…`);
      }
    } else {
      const hasLogin =
        (process.env.JOBALLA_EMPLOYER_TOKEN ?? '').trim() ||
        ((process.env.JOBALLA_EMPLOYER_IDENTIFIER ??
          process.env.JOBALLA_EMPLOYER_EMAIL ??
          '') &&
          (process.env.JOBALLA_EMPLOYER_PASSWORD ?? '').trim());
      if (!hasLogin) {
        throw new Error(
          'Remote employer tests need JOBALLA_EMPLOYER_IDENTIFIER + JOBALLA_EMPLOYER_PASSWORD, ' +
            'JOBALLA_EMPLOYER_TOKEN, JOBALLA_EMPLOYER_BOOTSTRAP=1 (DATABASE_URL / DIRECT_DB_URL), ' +
            'or JOBALLA_DEV_FIXED_OTP (six digits, must match server env on Render).',
        );
      }
    }
  }

  const fixedOtp = (process.env.JOBALLA_DEV_FIXED_OTP ?? '').trim();
  if (!/^[0-9]{6}$/.test(fixedOtp)) {
    throw new Error(
      'Set JOBALLA_DEV_FIXED_OTP (six digits) in .env for local register/verify bootstrap.',
    );
  }

  const suffix = `${Date.now()}`;
  const password = `TestPass99!${suffix.slice(-6)}`;
  const employerEmail = `employer-portal-${suffix}@example.test`;
  const workerEmail = `worker-portal-${suffix}@example.test`;
  const jar = /** @type {Record<string, string>} */ ({});

  async function registerVerify(email, role) {
    const canonical = email.toLowerCase();
    const reg = await fetchJson(base, '/auth/register', {
      method: 'POST',
      body: { email, password, role, languagePreference: 'EN' },
    });
    if (!reg.ok) {
      throw new Error(
        `register ${role} failed: ${reg.status} ${JSON.stringify(reg.data)}`,
      );
    }
    const ver = await fetchJson(base, '/auth/verify', {
      method: 'POST',
      jar,
      body: {
        identifier: canonical,
        otp: fixedOtp,
        role,
        password,
        languagePreference: 'EN',
      },
    });
    if (!ver.ok || !ver.data?.accessToken) {
      throw new Error(
        `verify ${role} failed: ${ver.status} ${JSON.stringify(ver.data)}`,
      );
    }
    return {
      token: ver.data.accessToken,
      userId: ver.data.user.id,
      canonical,
    };
  }

  const employer = await registerVerify(employerEmail, 'EMPLOYER');
  const worker = await registerVerify(workerEmail, 'WORKER');

  const me = await fetchJson(base, '/api/employer/me', {
    bearer: employer.token,
  });
  if (!me.ok || !me.data?.company?.id) {
    throw new Error(`GET /api/employer/me failed: ${me.status}`);
  }

  /** @type {EmployerTestState} */
  const state = {
    base,
    employerToken: employer.token,
    employerUserId: employer.userId,
    employerProfileId: me.data.company.id,
    employerEmail,
    workerToken: worker.token,
    workerUserId: worker.userId,
    workerProfileId: '',
    jar,
  };

  const prisma = getPrisma();
  const workerProfile = await prisma.workerProfile.findUnique({
    where: { userId: worker.userId },
  });
  if (!workerProfile) {
    throw new Error('Worker profile missing after verify.');
  }
  state.workerProfileId = workerProfile.id;

  if (opts.seedApplication !== false) {
    const jobRes = await fetchJson(base, '/api/employer/jobs', {
      method: 'POST',
      bearer: employer.token,
      body: sampleJobBody(),
    });
    if (!jobRes.ok || !jobRes.data?.jobId) {
      throw new Error(
        `bootstrap job create failed: ${jobRes.status} ${JSON.stringify(jobRes.data)}`,
      );
    }
    state.jobId = jobRes.data.jobId;

    await prisma.job.update({
      where: { id: state.jobId },
      data: { status: 'ACTIVE' },
    });

    const application = await prisma.application.create({
      data: {
        jobId: state.jobId,
        workerId: state.workerProfileId,
        profileSnapshot: {
          fullName: workerProfile.fullName,
          city: workerProfile.city ?? 'Buea',
          skills: workerProfile.skills.length
            ? workerProfile.skills
            : ['React', 'Communication'],
          verificationStatus: 'VERIFIED',
        },
        jobSpecificNote: 'Employer portal test application',
        status: 'SUBMITTED',
      },
    });
    state.applicationId = application.id;
  }

  return state;
}

export function sampleJobBody(overrides = {}) {
  return {
    title: 'Frontend Developer',
    city: 'Douala',
    neighbourhood: 'Bonanjo',
    description:
      'We are looking for a frontend developer for employer portal integration tests.',
    requiredSkills: ['React', 'TypeScript'],
    requiredLevel: 'Senior',
    employmentType: 'Full Time',
    durationValue: 9,
    durationUnit: 'Months',
    pay: 185000,
    currency: 'XAF',
    per: 'Month',
    numberOfOpenings: 2,
    startDate: '2026-06-01',
    startAsap: false,
    requirements: ['University degree or equivalent experience'],
    responsibilities: ['Build UI components', 'Collaborate with backend team'],
    ...overrides,
  };
}

/**
 * Load token from env and minimal state (no DB seed).
 * @returns {Promise<EmployerTestState | null>}
 */
async function resolveEmployerFixturesFromApi(base, token) {
  let workerProfileId = process.env.JOBALLA_TEST_WORKER_PROFILE_ID?.trim();
  let applicationId = process.env.JOBALLA_TEST_APPLICATION_ID?.trim();
  let jobId = process.env.JOBALLA_TEST_JOB_ID?.trim();

  const applicants = await fetchJson(base, '/api/employer/applicants?limit=20', {
    bearer: token,
  });
  if (applicants.ok && Array.isArray(applicants.data?.items) && applicants.data.items[0]) {
    const first = applicants.data.items[0];
    applicationId =
      applicationId ?? first.applicationId ?? first.id ?? undefined;
    workerProfileId =
      workerProfileId ??
      first.workerId ??
      first.worker?.workerId ??
      first.worker?.id ??
      undefined;
    jobId = jobId ?? first.jobId ?? first.job?.id ?? undefined;
  }

  return { workerProfileId, applicationId, jobId };
}

async function stateFromToken(base, token) {
  const me = await fetchJson(base, '/api/employer/me', { bearer: token });
  if (!me.ok || !me.data?.company?.id) return null;

  const fixtures = await resolveEmployerFixturesFromApi(base, token);

  return {
    base,
    employerToken: token,
    employerUserId: me.data.id,
    employerProfileId: me.data.company.id,
    employerEmail: me.data.email ?? '',
    workerToken: '',
    workerUserId: '',
    workerProfileId: fixtures.workerProfileId ?? '',
    jobId: fixtures.jobId,
    applicationId: fixtures.applicationId,
    shiftId: process.env.JOBALLA_TEST_SHIFT_ID,
    paymentId: process.env.JOBALLA_TEST_PAYMENT_ID,
    jar: {},
  };
}

export async function loadStateFromEnv() {
  const base = getBaseUrl();

  const token = (
    process.env.JOBALLA_EMPLOYER_TOKEN ?? ''
  ).trim();
  if (token) {
    return stateFromToken(base, token);
  }

  const identifier = (
    process.env.JOBALLA_EMPLOYER_IDENTIFIER ??
    process.env.JOBALLA_EMPLOYER_EMAIL ??
    ''
  ).trim();
  const password = (process.env.JOBALLA_EMPLOYER_PASSWORD ?? '').trim();
  if (identifier && password) {
    const login = await fetchJson(base, '/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    if (!login.ok || !login.data?.accessToken) return null;
    if (login.data.user?.role !== 'EMPLOYER') return null;
    return stateFromToken(base, login.data.accessToken);
  }

  return null;
}

export async function teardown() {
  await disconnectPrisma();
}
