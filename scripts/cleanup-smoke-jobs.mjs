#!/usr/bin/env node
import { loadRootDotenvOptional } from './lib/dotenv-lite.mjs';
import { getPrisma, disconnectPrisma } from './worker-portal/lib/prisma.mjs';

loadRootDotenvOptional();

const KEEP_EMAILS = ['fabricekongnyuy2@gmail.com', 'kongnyuy98765@gmail.com'];

async function main() {
  const prisma = getPrisma();

  const keepUsers = await prisma.user.findMany({
    where: { email: { in: KEEP_EMAILS } },
    select: { id: true, email: true },
  });
  if (keepUsers.length !== KEEP_EMAILS.length) {
    const found = keepUsers.map((u) => u.email);
    const missing = KEEP_EMAILS.filter((e) => !found.includes(e));
    throw new Error(`Missing keep users: ${missing.join(', ')}`);
  }
  const keepOwnerIds = keepUsers.map((u) => u.id);

  const jobsToDelete = await prisma.job.findMany({
    where: { ownerId: { notIn: keepOwnerIds } },
    select: { id: true, title: true, owner: { select: { email: true } } },
  });
  const jobIds = jobsToDelete.map((j) => j.id);

  if (jobIds.length === 0) {
    console.log('No jobs to delete.');
    await disconnectPrisma();
    return;
  }

  const keepCount = await prisma.job.count({
    where: { ownerId: { in: keepOwnerIds } },
  });
  console.log(
    `Deleting ${jobIds.length} job(s); keeping ${keepCount} for ${KEEP_EMAILS.join(', ')}`,
  );

  const engagementIds = (
    await prisma.workEngagement.findMany({
      where: { jobId: { in: jobIds } },
      select: { id: true },
    })
  ).map((e) => e.id);

  const result = await prisma.$transaction(async (tx) => {
    const disputes = engagementIds.length
      ? await tx.dispute.deleteMany({
          where: { engagementId: { in: engagementIds } },
        })
      : { count: 0 };
    const payments = engagementIds.length
      ? await tx.payment.deleteMany({
          where: { engagementId: { in: engagementIds } },
        })
      : { count: 0 };
    const engagements = await tx.workEngagement.deleteMany({
      where: { jobId: { in: jobIds } },
    });
    const apps = await tx.application.deleteMany({
      where: { jobId: { in: jobIds } },
    });
    const scores = await tx.submissionScore.deleteMany({
      where: { targetType: 'JOB', targetId: { in: jobIds } },
    });
    const changeReqs = await tx.changeRequest.deleteMany({
      where: { targetType: 'JOB', targetId: { in: jobIds } },
    });
    const rejections = await tx.rejectionReason.deleteMany({
      where: { targetType: 'JOB', targetId: { in: jobIds } },
    });
    await tx.informalJobRequest.updateMany({
      where: { assignedJobId: { in: jobIds } },
      data: { assignedJobId: null },
    });
    const jobs = await tx.job.deleteMany({ where: { id: { in: jobIds } } });
    return { disputes, payments, engagements, apps, scores, changeReqs, rejections, jobs };
  });

  console.log('Deleted related records:', result);

  const remaining = await prisma.job.count();
  const remainingByOwner = await prisma.job.groupBy({
    by: ['ownerId'],
    _count: true,
  });
  const owners = await prisma.user.findMany({
    where: { id: { in: remainingByOwner.map((r) => r.ownerId) } },
    select: { email: true, id: true },
  });
  console.log(`Remaining jobs: ${remaining}`);
  for (const row of remainingByOwner) {
    const email = owners.find((o) => o.id === row.ownerId)?.email ?? row.ownerId;
    console.log(`  ${email}: ${row._count}`);
  }

  await disconnectPrisma();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
