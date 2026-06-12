import bcrypt from 'bcrypt';
import { fetchJson } from '../../lib/fetch-json.mjs';
import { getBaseUrl } from '../../lib/config.mjs';
import { getPrisma, disconnectPrisma } from '../../worker-portal/lib/prisma.mjs';
import { seedDepartments } from '../../seed-departments.mjs';

const BCRYPT_ROUNDS = 12;

/**
 * @typedef {object} V2TestState
 * @property {string} base
 * @property {string} departmentId
 * @property {{ token: string; userId: string; email: string; password: string }} worker
 * @property {{ token: string; userId: string; email: string; password: string }} employer
 * @property {string} jobId
 * @property {string} [applicationId]
 * @property {string} [engagementId]
 * @property {string} [paymentId]
 * @property {string} [notificationId]
 * @property {Record<string, string>} jar
 */

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function ensureDepartment(prisma) {
  await seedDepartments(prisma);
  return prisma.department.findUniqueOrThrow({
    where: { slug: 'software-tech' },
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} workerUserId
 */
async function ensureApplyReadyProfile(prisma, workerUserId) {
  await prisma.workerProfile.update({
    where: { userId: workerUserId },
    data: {
      fullName: 'V2 Smoke Worker',
      firstName: 'V2',
      lastName: 'Worker',
      professionalTitle: 'Software Developer',
      shortBio: 'Profile seeded for v2 integration tests.',
      city: 'Douala',
      region: 'Littoral',
      country: 'Cameroon',
      skills: ['TypeScript', 'Node.js', 'Communication'],
      languages: ['eng', 'fre'],
      preferredJobCategories: ['software_tech'],
      profileCompleteness: 72,
      cvUrl: 'https://example.test/cv.pdf',
      verificationStatus: 'VERIFIED',
    },
  });
  const existing = await prisma.workExperience.findFirst({
    where: { workerId: workerUserId },
  });
  if (!existing) {
    await prisma.workExperience.create({
      data: {
        workerId: workerUserId,
        companyName: 'Smoke Corp',
        jobTitle: 'Developer',
        startDate: new Date('2022-01-01'),
        isCurrent: true,
      },
    });
  }
  const existingEducation = await prisma.education.findFirst({
    where: { workerId: workerUserId },
  });
  if (!existingEducation) {
    await prisma.education.create({
      data: {
        workerId: workerUserId,
        institutionName: 'University of Smoke',
        degree: 'BSc',
        fieldOfStudy: 'Computer Science',
        startDate: new Date('2018-09-01'),
        endDate: new Date('2022-06-01'),
        city: 'Douala',
        region: 'Littoral',
      },
    });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {V2TestState} state
 */
async function seedEngagementAndPayment(prisma, state) {
  const application = await prisma.application.create({
    data: {
      jobId: state.jobId,
      workerId: state.worker.userId,
      status: 'HIRED',
      coverNote: 'Available to start immediately.',
      profileSnapshot: {
        fullName: 'V2 Smoke Worker',
        professionalTitle: 'Frontend Developer, Marketer',
        shortBio: 'Experienced frontend engineer focused on React and product UI.',
        skills: ['React', 'TypeScript', 'HTML'],
        languagesSpoken: ['English', 'French'],
        phone: '+237600000001',
        workHistory: [
          {
            companyName: 'Smoke Tech Ltd',
            jobTitle: 'Frontend Developer',
            description: 'Built employer and worker portals.',
            startDate: '2024-01-01',
            endDate: null,
            isCurrent: true,
            location: 'Douala',
          },
        ],
        documents: [
          {
            fileName: 'smoke-cv.pdf',
            fileType: 'PDF',
            fileUrl: 'https://example.test/smoke-cv.pdf',
          },
        ],
      },
    },
  });
  state.applicationId = application.id;

  const job = await prisma.job.findUniqueOrThrow({ where: { id: state.jobId } });
  const engagement = await prisma.workEngagement.create({
    data: {
      jobId: state.jobId,
      applicationId: application.id,
      workerId: state.worker.userId,
      employerId: state.employer.userId,
      startDate: new Date(),
      employmentType: job.employmentType,
      payRate: job.payAmount,
      payStructure: job.payStructure,
      status: 'ACTIVE',
    },
  });
  state.engagementId = engagement.id;

  const payment = await prisma.payment.create({
    data: {
      engagementId: engagement.id,
      workerId: state.worker.userId,
      payerId: state.employer.userId,
      amount: 50000,
      mobileMoneyProvider: 'MTN_MOMO',
      recipientNumber: '+237600000001',
      idempotencyKey: `smoke-${Date.now()}-${engagement.id}`,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
  state.paymentId = payment.id;
}

/**
 * @returns {Promise<V2TestState>}
 */
export async function bootstrapV2TestState() {
  const base = getBaseUrl();
  const prisma = getPrisma();
  const suffix = `${Date.now()}`;
  const password = `V2Smoke!${suffix.slice(-6)}`;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const workerEmail = `v2-worker-${suffix}@example.test`;
  const employerEmail = `v2-employer-${suffix}@example.test`;

  const department = await ensureDepartment(prisma);

  const workerUser = await prisma.user.create({
    data: {
      email: workerEmail,
      passwordHash,
      role: 'WORKER',
      accountStatus: 'ACTIVE',
      preferredLanguage: 'ENG',
    },
  });

  await prisma.workerProfile.create({
    data: {
      userId: workerUser.id,
      fullName: 'V2 Smoke Worker',
      skills: ['TypeScript'],
      languages: ['eng'],
      preferredJobCategories: [],
      preferredJobTypes: [],
    },
  });
  await ensureApplyReadyProfile(prisma, workerUser.id);

  const employerUser = await prisma.user.create({
    data: {
      email: employerEmail,
      passwordHash,
      role: 'EMPLOYER',
      accountStatus: 'ACTIVE',
      preferredLanguage: 'ENG',
    },
  });

  await prisma.employerProfile.create({
    data: {
      userId: employerUser.id,
      companyName: `V2 Smoke Employer ${suffix}`,
      contactPersonName: 'Smoke Contact',
      verificationStatus: 'VERIFIED',
    },
  });

  const job = await prisma.job.create({
    data: {
      ownerId: employerUser.id,
      departmentId: department.id,
      title: `V2 smoke job ${suffix}`,
      employmentType: 'FULL_TIME',
      workMode: 'ONSITE',
      city: 'Douala',
      region: 'Littoral',
      country: 'Cameroon',
      payAmount: 150000,
      payStructure: 'MONTHLY',
      description: 'Seeded active job for v2 route tests.',
      requiredSkills: ['Communication'],
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
  });

  const workerLogin = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier: workerEmail, password },
  });
  if (!workerLogin.ok || !workerLogin.data?.accessToken) {
    throw new Error(
      `Worker login failed: ${workerLogin.status} ${JSON.stringify(workerLogin.data)}`,
    );
  }

  const employerLogin = await fetchJson(base, '/auth/login', {
    method: 'POST',
    body: { identifier: employerEmail, password },
  });
  if (!employerLogin.ok || !employerLogin.data?.accessToken) {
    throw new Error(
      `Employer login failed: ${employerLogin.status} ${JSON.stringify(employerLogin.data)}`,
    );
  }

  /** @type {V2TestState} */
  const state = {
    base,
    departmentId: department.id,
    worker: {
      token: workerLogin.data.accessToken,
      refreshToken: workerLogin.data.refreshToken,
      userId: workerUser.id,
      email: workerEmail,
      password,
    },
    employer: {
      token: employerLogin.data.accessToken,
      refreshToken: employerLogin.data.refreshToken,
      userId: employerUser.id,
      email: employerEmail,
      password,
    },
    jobId: job.id,
    jar: {},
  };

  const notification = await prisma.notification.create({
    data: {
      userId: workerUser.id,
      type: 'SYSTEM',
      title: 'Smoke test',
      body: 'V2 route notification',
    },
  });
  state.notificationId = notification.id;

  await seedEngagementAndPayment(prisma, state);

  return state;
}

export async function teardown() {
  await disconnectPrisma();
}
