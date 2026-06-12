#!/usr/bin/env node
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { getPrisma, disconnectPrisma } from './worker-portal/lib/prisma.mjs';
import { pathToFileURL } from 'url';

loadRootDotenvOptional();

const WORKER_EMAIL = 'fabricemokfembam@gmail.com';
const EMPLOYER_PRIMARY_EMAIL = 'fabricekongnyuy2@gmail.com';
const EMPLOYER_SECONDARY_EMAIL = 'kongnyuy98765@gmail.com';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} applicationId
 * @param {string} employerUserId
 */
async function ensureEngagementFromHire(prisma, applicationId, employerUserId) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, job: { ownerId: employerUserId } },
    include: { job: true },
  });
  if (!app) {
    throw new Error(`Application ${applicationId} not found for employer.`);
  }

  if (app.status !== 'HIRED') {
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'HIRED' },
    });
  }

  return prisma.workEngagement.upsert({
    where: { applicationId },
    create: {
      applicationId,
      jobId: app.jobId,
      workerId: app.workerId,
      employerId: employerUserId,
      startDate: app.job.startDate ?? new Date(),
      roleLabel: app.job.title,
      employmentType: app.job.employmentType,
      payRate: app.job.payAmount,
      payCurrency: app.job.payCurrency,
      payStructure: app.job.payStructure,
      status: 'ACTIVE',
    },
    update: { status: 'ACTIVE', terminatedAt: null, terminationReason: null },
    include: { job: { select: { title: true } } },
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedDisputes(prisma) {
  const worker = await prisma.user.findUnique({
    where: { email: WORKER_EMAIL },
  });
  const employerPrimary = await prisma.user.findUnique({
    where: { email: EMPLOYER_PRIMARY_EMAIL },
  });
  const employerSecondary = await prisma.user.findUnique({
    where: { email: EMPLOYER_SECONDARY_EMAIL },
  });

  if (!worker || worker.role !== 'WORKER') {
    throw new Error(`Worker not found: ${WORKER_EMAIL}`);
  }
  if (!employerPrimary || employerPrimary.role !== 'EMPLOYER') {
    throw new Error(`Employer not found: ${EMPLOYER_PRIMARY_EMAIL}`);
  }
  if (!employerSecondary || employerSecondary.role !== 'EMPLOYER') {
    throw new Error(`Employer not found: ${EMPLOYER_SECONDARY_EMAIL}`);
  }

  const primaryEngagement = await prisma.workEngagement.findFirst({
    where: { workerId: worker.id, employerId: employerPrimary.id },
    include: { job: { select: { title: true } } },
  });
  if (!primaryEngagement) {
    throw new Error(
      `No engagement between ${WORKER_EMAIL} and ${EMPLOYER_PRIMARY_EMAIL}. Hire the worker on an application first.`,
    );
  }

  const secondaryEngagement = await ensureEngagementFromHire(
    prisma,
    'c0cdbe05-baf6-4baa-a5e6-342033bc81a7',
    employerSecondary.id,
  );

  const superAdmin = await prisma.adminAccount.findFirst({
    where: { email: 'superadmin@joballa.cm' },
    select: { id: true },
  });

  const seeds = [
    {
      key: 'fabrice-payment-open',
      data: {
        raisedByUserId: worker.id,
        againstUserId: employerPrimary.id,
        engagementId: primaryEngagement.id,
        subject: 'March salary not received',
        description:
          'Worker reports that the March monthly payment of 275,000 XAF for the UI/UX Product Designer role was not received on the agreed date. Mobile money reference was expected by the 5th.',
        status: 'OPEN',
        priority: 'HIGH',
        type: 'PAYMENT_ISSUE',
      },
    },
    {
      key: 'kongnyuy-contract-review',
      data: {
        raisedByUserId: worker.id,
        againstUserId: employerSecondary.id,
        engagementId: secondaryEngagement.id,
        subject: 'Sales targets changed after hire',
        description:
          'Worker states that commission structure and daily visit targets were changed one week after starting the Field Sales Representative role without written agreement.',
        status: 'OPEN',
        priority: 'MEDIUM',
        type: 'CONTRACT_BREACH',
        adminNotes: 'Awaiting employer response and contract copy.',
      },
    },
    {
      key: 'kongnyuy-conduct-resolved',
      data: {
        raisedByUserId: worker.id,
        againstUserId: employerSecondary.id,
        engagementId: secondaryEngagement.id,
        subject: 'Hostile messages from site supervisor',
        description:
          'Worker filed a complaint about repeated hostile WhatsApp messages from a supervisor on the sales team. Messages occurred outside the Joballa chat.',
        status: 'RESOLVED',
        priority: 'LOW',
        type: 'HARASSMENT',
        adminNotes: 'Reviewed screenshots; warned employer contact person.',
        resolvedByAdminId: superAdmin?.id ?? null,
        resolutionDecision: 'APPROVE_WORKER',
        resolutionNotes:
          'Employer acknowledged inappropriate tone. Worker may continue engagement with direct manager change.',
        resolution: 'Worker complaint upheld; supervisor contact removed from daily coordination.',
        resolvedAt: new Date('2026-06-06T16:00:00.000Z'),
      },
    },
  ];

  const created = [];
  for (const seed of seeds) {
    const existing = await prisma.dispute.findFirst({
      where: {
        engagementId: seed.data.engagementId,
        subject: seed.data.subject,
      },
    });
    if (existing) {
      console.log(`  skip (exists) ${seed.key} → ${existing.id}`);
      created.push(existing);
      continue;
    }
    const row = await prisma.dispute.create({ data: seed.data });
    console.log(`  ${seed.key} → ${row.id} [${row.status}]`);
    created.push(row);
  }

  return {
    workerEmail: WORKER_EMAIL,
    employers: [EMPLOYER_PRIMARY_EMAIL, EMPLOYER_SECONDARY_EMAIL],
    engagements: [primaryEngagement.id, secondaryEngagement.id],
    disputes: created.map((d) => ({
      id: d.id,
      subject: d.subject,
      status: d.status,
    })),
  };
}

async function main() {
  const prisma = getPrisma();
  console.log('Seeding admin test disputes…');
  const summary = await seedDisputes(prisma);
  console.log('\nSummary:', JSON.stringify(summary, null, 2));
  console.log('\nAdmin: GET /admin/disputes (superadmin@joballa.cm)');
  await disconnectPrisma();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
