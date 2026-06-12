#!/usr/bin/env node
/**
 * Delete all jobs not owned by the given employer emails.
 *
 *   node scripts/delete-jobs-except-owners.mjs --keep=fabricekongnyuy2@gmail.com --keep=kongnyuy98765@gmail.com
 */
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { getPrisma, disconnectPrisma } from './employer-portal/lib/prisma.mjs';

loadRootDotenvOptional();

const keepEmails = process.argv
  .filter((a) => a.startsWith('--keep='))
  .map((a) => a.slice('--keep='.length).trim().toLowerCase());

if (keepEmails.length === 0) {
  console.error(
    'Usage: node scripts/delete-jobs-except-owners.mjs --keep=employer1@example.com --keep=employer2@example.com',
  );
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();

  const owners = await prisma.user.findMany({
    where: { email: { in: keepEmails }, role: 'EMPLOYER' },
    select: { id: true, email: true },
  });

  if (owners.length !== keepEmails.length) {
    const found = new Set(owners.map((o) => o.email));
    const missing = keepEmails.filter((e) => !found.has(e));
    console.error('Missing employer accounts:', missing.join(', '));
    process.exit(1);
  }

  const keepOwnerIds = owners.map((o) => o.id);
  const jobsToDelete = await prisma.job.findMany({
    where: { ownerId: { notIn: keepOwnerIds } },
    select: { id: true, title: true, ownerId: true },
  });

  if (jobsToDelete.length === 0) {
    console.log('No jobs to delete.');
    await disconnectPrisma();
    return;
  }

  const jobIds = jobsToDelete.map((j) => j.id);
  console.log(`Deleting ${jobIds.length} job(s) not owned by:`);
  owners.forEach((o) => console.log(`  - ${o.email}`));

  await prisma.$transaction(async (tx) => {
    const engagements = await tx.workEngagement.findMany({
      where: { jobId: { in: jobIds } },
      select: { id: true },
    });
    const engagementIds = engagements.map((e) => e.id);

    if (engagementIds.length) {
      await tx.payment.deleteMany({ where: { engagementId: { in: engagementIds } } });
      await tx.dispute.deleteMany({ where: { engagementId: { in: engagementIds } } });
      await tx.workEngagement.deleteMany({ where: { id: { in: engagementIds } } });
    }

    await tx.application.deleteMany({ where: { jobId: { in: jobIds } } });
    await tx.submissionScore.deleteMany({
      where: { targetType: 'JOB', targetId: { in: jobIds } },
    });
    await tx.rejectionReason.deleteMany({
      where: { targetType: 'JOB', targetId: { in: jobIds } },
    });
    await tx.changeRequest.deleteMany({
      where: { targetType: 'JOB', targetId: { in: jobIds } },
    });

    await tx.informalJobRequest.updateMany({
      where: { assignedJobId: { in: jobIds } },
      data: { assignedJobId: null },
    });

    const deleted = await tx.job.deleteMany({
      where: { id: { in: jobIds } },
    });

    console.log(`Deleted ${deleted.count} jobs.`);
  });

  const remaining = await prisma.job.count();
  const kept = await prisma.job.findMany({
    select: { id: true, title: true, owner: { select: { email: true } } },
  });
  console.log(`Remaining jobs: ${remaining}`);
  kept.forEach((j) => console.log(`  - ${j.title} (${j.owner.email})`));

  await disconnectPrisma();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
