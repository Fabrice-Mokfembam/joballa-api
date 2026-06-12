import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApplicationStatus, JobStatus, PaymentStatus } from '@prisma/client';
import { WorkersService } from './workers.service';
import { mapJobCard } from '../../jobs/utils/job-card.mapper';
import { computeProfileStrengthBreakdown } from '../utils/profile-strength.util';

@Injectable()
export class WorkerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
  ) {}

  async getDashboard(userId: string) {
    const workerId = await this.workersService.getWorkerProfileId(userId);
    const profile = await this.prisma.workerProfile.findUniqueOrThrow({
      where: { id: workerId },
      include: { kycSubmissions: { take: 5 } },
    });

    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeApplications,
      shortlisted,
      earningsMonth,
      recentApplications,
      recommendedJobs,
      appliedJobIds,
    ] = await Promise.all([
      this.prisma.application.count({
        where: {
          workerId,
          status: {
            in: [ApplicationStatus.SUBMITTED, ApplicationStatus.SHORTLISTED],
          },
        },
      }),
      this.prisma.application.count({
        where: {
          workerId,
          status: ApplicationStatus.SHORTLISTED,
          submittedAt: { gte: weekStart },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          workerId,
          status: PaymentStatus.COMPLETED,
          confirmedAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.application.findMany({
        where: { workerId },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              payRate: true,
              currency: true,
              payStructure: true,
              jobType: true,
              city: true,
              region: true,
              employer: { select: { companyName: true, logoUrl: true } },
            },
          },
        },
      }),
      this.prisma.job.findMany({
        where: { status: JobStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          jobType: true,
          workMode: true,
          location: true,
          city: true,
          region: true,
          neighbourhood: true,
          payRate: true,
          payStructure: true,
          currency: true,
          numberOfOpenings: true,
          requiredSkills: true,
          requiredLevel: true,
          startAsap: true,
          startDate: true,
          durationValue: true,
          durationUnit: true,
          status: true,
          createdAt: true,
          employer: {
            select: {
              id: true,
              companyName: true,
              logoUrl: true,
              isJoballaDepartment: true,
              verificationStatus: true,
            },
          },
          _count: { select: { applications: true } },
        },
      }),
      this.prisma.application.findMany({
        where: { workerId },
        select: { jobId: true, id: true },
      }),
    ]);

    const appliedMap = new Map(
      appliedJobIds.map((a) => [a.jobId, a.id] as const),
    );

    const breakdown =
      (profile.profileStrengthBreakdown as Record<string, boolean> | null) ??
      computeProfileStrengthBreakdown({
        ...profile,
        workHistories: [],
        educations: [],
        certifications: [],
        kycSubmissions: profile.kycSubmissions,
      });

    const firstName =
      profile.firstName ?? profile.fullName.split(' ')[0] ?? profile.fullName;

    return {
      greeting: {
        name: firstName,
        profileSetupMessage:
          profile.profileCompleteness < 60
            ? 'Complete your profile to apply for jobs'
            : 'Your profile is ready — explore new opportunities',
      },
      stats: {
        activeApplications: {
          count: activeApplications,
          trendLabel: `${activeApplications} active`,
        },
        shortlisted: {
          count: shortlisted,
          trendLabel: `+${shortlisted} this week`,
        },
        profileViews: {
          count: profile.profileViews,
          trendLabel: `${profile.profileViews} total views`,
        },
        earnings: {
          amount: Number(earningsMonth._sum.amount ?? 0),
          currency: 'XAF',
          trendLabel: 'this month',
        },
      },
      recommendedJobs: recommendedJobs
        .filter((j) => !appliedMap.has(j.id))
        .map((j) =>
          mapJobCard(j, {
            appliedByJobId: appliedMap,
          }),
        ),
      applications: recentApplications.map((a) => ({
        id: a.id,
        slug: a.id,
        status: a.status,
        appliedAt: a.submittedAt.toISOString(),
        jobId: a.jobId,
        jobTitle: a.job.title,
        companyName: a.job.employer.companyName,
        companyLogoUrl: a.job.employer.logoUrl,
        payRate: Number(a.job.payRate),
        currency: a.job.currency,
        payStructure: a.job.payStructure,
        jobType: a.job.jobType,
        city: a.job.city,
        region: a.job.region,
        matchPercent: a.matchPercent,
        lastStatusMessage: a.lastStatusMessage,
      })),
      profileCompleteness: profile.profileCompleteness,
      profileStrengthBreakdown: breakdown,
    };
  }
}
