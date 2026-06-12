#!/usr/bin/env node
/**
 * Delete jobs by exact title(s).
 *
 *   node scripts/delete-jobs-by-title.mjs --title="Minimal smoke job 1780711078171"
 */
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { getPrisma, disconnectPrisma } from './employer-portal/lib/prisma.mjs';

loadRootDotenvOptional();

const titles = process.argv
  .filter((a) => a.startsWith('--title='))
  .map((a) => a.slice('--title='.length).trim());

if (titles.length === 0) {
  console.error('Usage: node scripts/delete-jobs-by-title.mjs --title="Job title"');
  process.exit(1);
}

async function deleteJobsByIds(prisma, jobIds) {
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

    await tx.job.deleteMany({ where: { id: { in: jobIds } } });
  });
}

async function main() {
  const prisma = getPrisma();

  const jobs = await prisma.job.findMany({
    where: { title: { in: titles } },
    select: { id: true, title: true },
  });

  if (jobs.length === 0) {
    console.log('No matching jobs found.');
    await disconnectPrisma();
    return;
  }

  const jobIds = jobs.map((j) => j.id);
  console.log(`Deleting ${jobs.length} job(s):`);
  jobs.forEach((j) => console.log(`  - ${j.title}`));

  await deleteJobsByIds(prisma, jobIds);

  console.log('Done.');
  await disconnectPrisma();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
