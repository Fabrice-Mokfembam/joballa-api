import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ApplicationSource,
  ApplicationStatus,
  DepartmentCategory,
  EmploymentType,
  EngagementStatus,
  ExperienceLevel,
  InformalRequestStatus,
  JobStatus,
  JobPostedByType,
  KycType,
  MomoProvider,
  NotificationType,
  PayStructure,
  PreferredLanguage,
  Role,
  SubmissionTargetType,
  SubmissionTier,
  VerificationStatus,
  WorkMode,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  buildApplicantProfileSnapshot,
  mergeApplicantDocuments,
  normalizeApplicantProfileSnapshot,
  normalizeAttachedDocuments,
} from '../employer/employer-applicant-snapshot.util';
import { resolveApplicantFileByIndex } from '../shared/applicant-file.util';
import { enrichApplicantDocuments } from '../shared/document-url.util';
import {
  JOB_OWNER_APPLICATION_INCLUDE,
  mapJobOwnerApplicantDetail,
  mapJobOwnerApplicantListItem,
} from '../shared/job-owner-applicants.util';
import {
  assertPublishableStatus,
  draftEmploymentType,
  draftPayStructure,
  parseOptionalDepartmentId,
  parseOptionalJobDate,
  parseRequiredDepartmentId,
  validateJobForPublish,
} from '../shared/job-validation.util';
import type { LocalAuthUser } from '../../../common/types/auth-context.type';
import {
  accountStatusToApi,
  applicationStatusToApi,
  departmentCategoryToApi,
  documentTypeToApi,
  employmentTypeToApi,
  engagementStatusToApi,
  fileTypeFromMime,
  informalStatusToApi,
  jobPostedByTypeToApi,
  jobStatusToApi,
  languageToApi,
  pageParams,
  paginated,
  parseEnum,
  payStructureToApi,
  providerToApi,
  tierToApi,
  verificationToApi,
  workModeToApi,
} from '../shared/api-format';
import {
  applyCustomizeToSnapshot,
  mergeCustomizeProfile,
  normalizeCustomizeBody,
  validateCoverNoteLimit,
  validateCustomizeProfileLimits,
} from './worker-application-draft.util';
import { deriveAvailableForHire } from './worker-availability.util';
import { validateCredentialUrl } from './worker-credential-url.util';
import {
  emitWorkerNotification,
  notificationApiType,
  notificationDeepLink,
} from './worker-notification.util';
import {
  computeWeightedProfileCompleteness,
  MIN_PROFILE_COMPLETENESS_TO_APPLY,
} from './worker-profile-completeness.util';
import {
  sortCertificationsDesc,
  sortWorkOrEducationDesc,
} from './worker-subresource-sort.util';

@Injectable()
export class WorkerV2Service {
  constructor(private readonly prisma: PrismaService) {}

  async me(user: LocalAuthUser) {
    const full = await this.requireWorker(user.id);
    const p = full.workerProfile!;
    const breakdown = this.parseBreakdown(p.profileCompletenessBreakdown);
    return {
      id: full.id,
      email: full.email,
      phone: full.phone,
      role: 'worker',
      preferredLanguage: languageToApi(full.preferredLanguage),
      accountStatus: accountStatusToApi(full.accountStatus),
      workerProfile: {
        id: p.id,
        fullName: p.fullName,
        professionalTitle: p.professionalTitle,
        photoUrl: full.photoUrl,
        verificationStatus: verificationToApi(p.verificationStatus),
        profileCompleteness: p.profileCompleteness,
        profileStrengthBreakdown: breakdown,
        availabilityStatus: p.availabilityStatus,
        availableForHire: deriveAvailableForHire(p.availabilityStatus),
      },
    };
  }

  async dashboard(user: LocalAuthUser) {
    const [me, applications, savedJobs, payments, suggestedJobs, savedRows] =
      await Promise.all([
        this.me(user),
        this.prisma.application.findMany({
          where: { workerId: user.id },
          take: 5,
          orderBy: { submittedAt: 'desc' },
          include: {
            job: {
              include: {
                department: true,
                owner: {
                  include: { employerProfile: true, workerProfile: true },
                },
                _count: { select: { applications: true } },
              },
            },
          },
        }),
        this.prisma.savedJob.count({ where: { workerId: user.id } }),
        this.prisma.payment.findMany({ where: { workerId: user.id } }),
        this.prisma.job.findMany({
          where: { status: JobStatus.ACTIVE },
          take: 6,
          orderBy: { createdAt: 'desc' },
          include: {
            department: true,
            owner: { include: { employerProfile: true, workerProfile: true } },
          },
        }),
        this.prisma.savedJob.findMany({
          where: { workerId: user.id },
          select: { jobId: true },
        }),
      ]);

    const totalEarnings = payments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      welcomeName: me.workerProfile.fullName ?? 'Worker',
      verificationStatus: me.workerProfile.verificationStatus,
      profileCompleteness: me.workerProfile.profileCompleteness,
      stats: {
        totalEarnings,
        activeApplications: applications.filter(
          (a) =>
            a.status === ApplicationStatus.SUBMITTED ||
            a.status === ApplicationStatus.SHORTLISTED,
        ).length,
        jobsCompleted: await this.prisma.workEngagement.count({
          where: { workerId: user.id, status: EngagementStatus.COMPLETED },
        }),
        savedJobs,
      },
      recentApplications: applications.map((a) => this.mapApplicationList(a)),
      suggestedJobs: suggestedJobs.map((j) =>
        this.withSavedFlags(this.mapJobCard(j), savedRows, j.id),
      ),
      nextActions: [
        {
          key: 'complete_profile',
          label: 'Complete profile',
          href: '/worker/profile/edit',
        },
        { key: 'find_jobs', label: 'Find jobs', href: '/worker/jobs' },
        {
          key: 'need_someone',
          label: 'Need someone?',
          href: '/worker/jobs/new',
        },
      ],
    };
  }

  async listJobs(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const hidden = await this.prisma.hiddenJob.findMany({
      where: { workerId: user.id },
      select: { jobId: true },
    });
    const hiddenIds = hidden.map((h) => h.jobId);
    const where = {
      status: JobStatus.ACTIVE,
      ...(hiddenIds.length ? { id: { notIn: hiddenIds } } : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains: String(query.search),
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: String(query.search),
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
      ...(query.departmentId
        ? { departmentId: String(query.departmentId) }
        : {}),
      ...(query.city
        ? {
            city: {
              contains: String(query.city),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(query.region
        ? {
            region: {
              contains: String(query.region),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(parseEnum(EmploymentType, query.employmentType)
        ? { employmentType: parseEnum(EmploymentType, query.employmentType) }
        : {}),
      ...(parseEnum(WorkMode, query.workMode)
        ? { workMode: parseEnum(WorkMode, query.workMode) }
        : {}),
      ...(parseEnum(PayStructure, query.payStructure)
        ? { payStructure: parseEnum(PayStructure, query.payStructure) }
        : {}),
    };
    const orderBy =
      query.sort === 'highest_pay'
        ? { payAmount: 'desc' as const }
        : { createdAt: 'desc' as const };
    const [jobs, total, saved] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          department: true,
          owner: { include: { employerProfile: true, workerProfile: true } },
        },
      }),
      this.prisma.job.count({ where }),
      this.prisma.savedJob.findMany({
        where: { workerId: user.id },
        select: { jobId: true },
      }),
    ]);
    return paginated(
      jobs.map((j) =>
        this.withSavedFlags(this.mapJobCard(j), saved, j.id, false),
      ),
      total,
      page,
      limit,
    );
  }

  async jobDetail(user: LocalAuthUser, jobId: string) {
    const [job, saved] = await Promise.all([
      this.prisma.job.findFirst({
        where: { id: jobId, status: JobStatus.ACTIVE },
        include: {
          department: true,
          owner: { include: { employerProfile: true, workerProfile: true } },
          applications: { where: { workerId: user.id }, take: 1 },
        },
      }),
      this.prisma.savedJob.findUnique({
        where: { workerId_jobId: { workerId: user.id, jobId } },
      }),
    ]);
    if (!job) throw new NotFoundException('Job not found.');
    return {
      ...this.withSavedFlags(this.mapJobCard(job), saved ? [saved] : [], jobId),
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      requestedDocuments: Array.isArray(job.requestedDocuments)
        ? job.requestedDocuments
        : [],
      numberOfOpenings: job.numberOfOpenings,
      startDate: job.startDate?.toISOString().slice(0, 10) ?? null,
      startNow: job.startNow,
      owner: {
        id: job.ownerId,
        displayName: this.ownerName(job),
        verified: this.ownerVerified(job),
        photoUrl: job.owner.photoUrl,
      },
      viewerApplication: job.applications[0]
        ? {
            id: job.applications[0].id,
            status: applicationStatusToApi(job.applications[0].status),
          }
        : null,
    };
  }

  async apply(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    const worker = await this.requireWorker(user.id);
    const profile = worker.workerProfile!;
    if (profile.verificationStatus !== VerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        'KYC verification is required before applying.',
      );
    }
    if (profile.profileCompleteness < MIN_PROFILE_COMPLETENESS_TO_APPLY) {
      throw new ForbiddenException(
        `Profile completeness is ${profile.profileCompleteness}%. A minimum of ${MIN_PROFILE_COMPLETENESS_TO_APPLY}% is required to apply.`,
      );
    }
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, status: JobStatus.ACTIVE },
    });
    if (!job) throw new NotFoundException('Job not found.');
    if (job.ownerId === user.id) {
      throw new BadRequestException('You cannot apply to a job you posted.');
    }

    const existing = await this.prisma.application.findUnique({
      where: { jobId_workerId: { jobId, workerId: user.id } },
    });
    if (existing) {
      throw new ConflictException('You have already applied to this job.');
    }

    const [
      workExperiences,
      supportingDocuments,
      educations,
      certifications,
      draft,
    ] = await Promise.all([
      this.prisma.workExperience.findMany({ where: { workerId: user.id } }),
      this.prisma.supportingDocument.findMany({ where: { workerId: user.id } }),
      this.prisma.education.findMany({ where: { workerId: user.id } }),
      this.prisma.certification.findMany({ where: { workerId: user.id } }),
      this.prisma.applicationProfileDraft.findUnique({
        where: { workerId_jobId: { workerId: user.id, jobId } },
      }),
    ]);

    let profileSnapshot = buildApplicantProfileSnapshot({
      user: worker,
      profile,
      workExperiences: sortWorkOrEducationDesc(workExperiences),
      educations: sortWorkOrEducationDesc(educations),
      certifications: sortCertificationsDesc(certifications),
      supportingDocuments,
      jobRequiredSkills: job.requiredSkills,
    });

    if (draft?.customizedData) {
      const customized = normalizeCustomizeBody(
        draft.customizedData as Record<string, unknown>,
      );
      validateCustomizeProfileLimits(customized);
      profileSnapshot = applyCustomizeToSnapshot(profileSnapshot, customized);
    }

    const coverNote =
      typeof body.coverNote === 'string'
        ? body.coverNote.trim() || undefined
        : typeof body.jobSpecificNote === 'string'
          ? body.jobSpecificNote.trim() || undefined
          : undefined;
    validateCoverNoteLimit(coverNote);

    let application;
    try {
      application = await this.prisma.application.create({
        data: {
          jobId,
          workerId: user.id,
          source: parseApplicationSource(body.source),
          coverNote,
          attachedDocuments:
            (body.attachedDocuments as object[] | undefined) ?? [],
          profileSnapshot: profileSnapshot as unknown as Prisma.InputJsonValue,
        },
        include: {
          job: {
            include: {
              department: true,
              owner: {
                include: { employerProfile: true, workerProfile: true },
              },
            },
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('You have already applied to this job.');
      }
      throw err;
    }

    await this.prisma.applicationProfileDraft.deleteMany({
      where: { workerId: user.id, jobId },
    });

    await emitWorkerNotification(this.prisma, {
      userId: user.id,
      type: NotificationType.APPLICATION_RECEIVED,
      title: 'Application submitted',
      body: `Your application for ${job.title} was submitted.`,
      relatedType: 'application',
      relatedId: application.id,
    });

    return this.mapApplicationDetail(application);
  }

  async saveJob(user: LocalAuthUser, jobId: string, saved: boolean) {
    if (saved) {
      await this.prisma.savedJob.upsert({
        where: { workerId_jobId: { workerId: user.id, jobId } },
        create: { workerId: user.id, jobId },
        update: {},
      });
    } else {
      await this.prisma.savedJob.deleteMany({
        where: { workerId: user.id, jobId },
      });
    }
    return { jobId, saved };
  }

  async hideJob(user: LocalAuthUser, jobId: string, hidden: boolean) {
    if (hidden) {
      await this.prisma.hiddenJob.upsert({
        where: { workerId_jobId: { workerId: user.id, jobId } },
        create: { workerId: user.id, jobId },
        update: {},
      });
    } else {
      await this.prisma.hiddenJob.deleteMany({
        where: { workerId: user.id, jobId },
      });
    }
    return { jobId, hidden };
  }

  async reportJob(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    const report = await this.prisma.jobReport.create({
      data: {
        workerId: user.id,
        jobId,
        reason: String(body.reason ?? 'Reported by worker'),
      },
    });
    return { id: report.id, jobId, message: 'Job reported.' };
  }

  shareJob(jobId: string) {
    return { url: `https://joballa.com/jobs/${jobId}` };
  }

  async departments(user: LocalAuthUser, query: Record<string, unknown>) {
    await this.requireWorker(user.id);
    const activeOnly =
      query.isActive === undefined ||
      query.isActive === true ||
      query.isActive === 'true';
    const category = parseEnum(DepartmentCategory, query.category);
    const rows = await this.prisma.department.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    const data = rows.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      category: departmentCategoryToApi(d.category),
      isActive: d.isActive,
    }));
    return {
      data,
      total: data.length,
      page: 1,
      limit: Math.max(data.length, 50),
    };
  }

  async postedJobs(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(JobStatus, query.status);
    const where = {
      ownerId: user.id,
      ...(status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.postedJobInclude(),
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginated(
      rows.map((j) => this.mapPostedJobCard(j)),
      total,
      page,
      limit,
    );
  }

  async createPostedJob(user: LocalAuthUser, body: Record<string, unknown>) {
    await this.requireWorker(user.id);
    const isDraft = Boolean(body.asDraft);
    const status = isDraft ? JobStatus.DRAFT : JobStatus.UNDER_REVIEW;

    if (!isDraft) {
      validateJobForPublish({
        status: JobStatus.DRAFT,
        departmentId: parseRequiredDepartmentId(body.departmentId),
        title: String(body.title ?? ''),
        employmentType: this.requiredEnum(
          EmploymentType,
          body.employmentType,
          'employmentType',
        ),
        workMode: parseEnum(WorkMode, body.workMode) ?? WorkMode.ONSITE,
        country: String(body.country ?? 'Cameroon'),
        city: String(body.city ?? ''),
        payAmount: Number(body.payAmount ?? 0),
        payCurrency: String(body.payCurrency ?? 'XAF'),
        payStructure: this.requiredEnum(
          PayStructure,
          body.payStructure,
          'payStructure',
        ),
        description: String(body.description ?? ''),
        startDate: parseOptionalJobDate(body.startDate) ?? null,
        startNow: Boolean(body.startNow),
      });
    }

    const job = await this.prisma.job.create({
      data: {
        ownerId: user.id,
        departmentId: isDraft
          ? parseOptionalDepartmentId(body.departmentId)
          : parseRequiredDepartmentId(body.departmentId),
        title: String(body.title ?? ''),
        employmentType: isDraft
          ? draftEmploymentType(body.employmentType)
          : this.requiredEnum(
              EmploymentType,
              body.employmentType,
              'employmentType',
            ),
        workMode: parseEnum(WorkMode, body.workMode) ?? WorkMode.ONSITE,
        country: String(body.country ?? 'Cameroon'),
        region: maybeString(body.region),
        city: String(body.city ?? ''),
        neighbourhood: maybeString(body.neighbourhood),
        payAmount: Number(body.payAmount ?? 0),
        payCurrency: String(body.payCurrency ?? 'XAF'),
        payStructure: isDraft
          ? draftPayStructure(body.payStructure)
          : this.requiredEnum(PayStructure, body.payStructure, 'payStructure'),
        experienceLevel: parseEnum(ExperienceLevel, body.experienceLevel),
        startDate: parseOptionalJobDate(body.startDate),
        startNow: Boolean(body.startNow),
        duration: maybeString(body.duration),
        description: String(body.description ?? ''),
        requirements: maybeStringArray(body.requirements) ?? [],
        responsibilities: maybeStringArray(body.responsibilities) ?? [],
        requiredSkills: maybeStringArray(body.requiredSkills) ?? [],
        requestedDocuments:
          (body.requestedDocuments as object[] | undefined) ?? [],
        numberOfOpenings: Number(body.numberOfOpenings ?? 1),
        status,
        postedByType: JobPostedByType.WORKER,
        paymentManagedByJoballa: Boolean(body.paymentManagedByJoballa),
      },
      include: this.postedJobInclude(),
    });

    const submissionScore = isDraft
      ? { score: 0, tier: SubmissionTier.YELLOW_ZONE }
      : { score: 90, tier: SubmissionTier.AUTO_APPROVED };

    await this.prisma.submissionScore.create({
      data: {
        targetType: SubmissionTargetType.JOB,
        targetId: job.id,
        score: submissionScore.score,
        tier: submissionScore.tier,
      },
    });

    return {
      jobId: job.id,
      status: jobStatusToApi(job.status),
      submissionScore: {
        score: submissionScore.score,
        tier: tierToApi(submissionScore.tier),
      },
      message: isDraft
        ? 'Job saved as draft.'
        : 'Job submitted. Joballa admin will review before going live.',
    };
  }

  async postedJobDetail(user: LocalAuthUser, jobId: string) {
    const job = await this.findOwnedPostedJob(user.id, jobId);
    const rejectionReason = await this.loadJobRejectionReason(jobId);
    return this.mapPostedJobDetail(job, rejectionReason);
  }

  async updatePostedJob(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    await this.findOwnedPostedJob(user.id, jobId);
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        title: maybeString(body.title),
        departmentId:
          body.departmentId === undefined
            ? undefined
            : parseOptionalDepartmentId(body.departmentId),
        employmentType: parseEnum(EmploymentType, body.employmentType),
        workMode: parseEnum(WorkMode, body.workMode),
        country: maybeString(body.country),
        region: maybeString(body.region),
        city: maybeString(body.city),
        neighbourhood: maybeString(body.neighbourhood),
        payAmount:
          body.payAmount === undefined ? undefined : Number(body.payAmount),
        payCurrency: maybeString(body.payCurrency),
        payStructure: parseEnum(PayStructure, body.payStructure),
        experienceLevel: parseEnum(ExperienceLevel, body.experienceLevel),
        startDate: parseOptionalJobDate(body.startDate),
        startNow:
          body.startNow === undefined ? undefined : Boolean(body.startNow),
        duration: maybeString(body.duration),
        description: maybeString(body.description),
        requirements: maybeStringArray(body.requirements),
        responsibilities: maybeStringArray(body.responsibilities),
        requiredSkills: maybeStringArray(body.requiredSkills),
        requestedDocuments: body.requestedDocuments as object[] | undefined,
        numberOfOpenings:
          body.numberOfOpenings === undefined
            ? undefined
            : Number(body.numberOfOpenings),
        paymentManagedByJoballa:
          body.paymentManagedByJoballa === undefined
            ? undefined
            : Boolean(body.paymentManagedByJoballa),
      },
      include: this.postedJobInclude(),
    });
    return this.mapPostedJobDetail(job);
  }

  async publishPostedJob(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown> = {},
  ) {
    const current = await this.findOwnedPostedJob(user.id, jobId);
    assertPublishableStatus(current.status);
    if (Object.keys(body).length > 0) {
      await this.updatePostedJob(user, jobId, body);
    }
    const job = await this.findOwnedPostedJob(user.id, jobId);
    validateJobForPublish({
      status: job.status,
      departmentId: job.departmentId,
      title: job.title,
      employmentType: job.employmentType,
      workMode: job.workMode,
      country: job.country,
      city: job.city,
      payAmount: job.payAmount,
      payCurrency: job.payCurrency,
      payStructure: job.payStructure,
      description: job.description,
      startDate: job.startDate,
      startNow: job.startNow,
    });
    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.UNDER_REVIEW },
      include: this.postedJobInclude(),
    });
    const existingScore = await this.prisma.submissionScore.findFirst({
      where: {
        targetType: SubmissionTargetType.JOB,
        targetId: jobId,
      },
    });
    if (existingScore) {
      await this.prisma.submissionScore.update({
        where: { id: existingScore.id },
        data: { score: 90, tier: SubmissionTier.AUTO_APPROVED },
      });
    } else {
      await this.prisma.submissionScore.create({
        data: {
          targetType: SubmissionTargetType.JOB,
          targetId: jobId,
          score: 90,
          tier: SubmissionTier.AUTO_APPROVED,
        },
      });
    }
    return {
      jobId: updated.id,
      status: jobStatusToApi(updated.status),
      message:
        'Job submitted for review. Joballa admin will review before it goes live.',
    };
  }

  async deletePostedJob(user: LocalAuthUser, jobId: string) {
    await this.prisma.job.deleteMany({
      where: { id: jobId, ownerId: user.id },
    });
    return { ok: true };
  }

  async updatePostedJobStatus(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    const current = await this.findOwnedPostedJob(user.id, jobId);
    let status = this.requiredEnum(JobStatus, body.status, 'status');
    if (status === JobStatus.PAUSED) {
      status = JobStatus.CLOSED;
    }
    if (status === JobStatus.ACTIVE && current.status !== JobStatus.PAUSED) {
      throw new BadRequestException(
        'Jobs must be approved by Joballa admin before going active. Use pause to resume an already approved job.',
      );
    }
    const job = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        approvedAt:
          status === JobStatus.ACTIVE
            ? (current.approvedAt ?? new Date())
            : undefined,
      },
      include: this.postedJobInclude(),
    });
    const rejectionReason = await this.loadJobRejectionReason(jobId);
    return this.mapPostedJobDetail(job, rejectionReason);
  }

  async workforce(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(EngagementStatus, query.status);
    const where = { employerId: user.id, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.workEngagement.findMany({
        where,
        skip,
        take: limit,
        include: this.jobOwnerEngagementInclude(),
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.workEngagement.count({ where }),
    ]);
    return paginated(
      rows.map((e) => this.mapJobOwnerWorkforce(e)),
      total,
      page,
      limit,
    );
  }

  async workforceDetail(user: LocalAuthUser, workerId: string) {
    const row = await this.prisma.workEngagement.findFirst({
      where: { employerId: user.id, workerId },
      include: { ...this.jobOwnerEngagementInclude(), payments: true },
      orderBy: { startedAt: 'desc' },
    });
    if (!row) throw new NotFoundException('Worker engagement not found.');
    return {
      ...this.mapJobOwnerWorkforce(row),
      profileSnapshot: row.application.profileSnapshot,
      publicProfile: row.worker.workerProfile,
      taskNotes: row.taskNotes,
      terminationReason: row.terminationReason,
      payments: row.payments.map((p) => this.mapJobOwnerPayment(p, row)),
    };
  }

  async updateWorkforceStatus(
    user: LocalAuthUser,
    workerId: string,
    body: Record<string, unknown>,
  ) {
    const status = this.requiredEnum(EngagementStatus, body.status, 'status');
    const engagementId = String(body.engagementId ?? '');
    const row = await this.prisma.workEngagement.update({
      where: { id: engagementId, employerId: user.id, workerId },
      data: {
        status,
        terminationReason:
          status === EngagementStatus.TERMINATED
            ? maybeString(body.reason)
            : undefined,
        completedAt:
          status === EngagementStatus.COMPLETED ? new Date() : undefined,
        terminatedAt:
          status === EngagementStatus.TERMINATED ? new Date() : undefined,
      },
      include: { ...this.jobOwnerEngagementInclude(), payments: true },
    });
    return {
      ...this.mapJobOwnerWorkforce(row),
      taskNotes: row.taskNotes,
      terminationReason: row.terminationReason,
      payments: row.payments.map((p) => this.mapJobOwnerPayment(p, row)),
    };
  }

  async applicantFilters(user: LocalAuthUser) {
    const jobs = await this.prisma.job.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      jobs,
      statuses: ['submitted', 'shortlisted', 'hired', 'rejected'],
    };
  }

  async applicants(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(ApplicationStatus, query.status);
    const where = {
      job: {
        ownerId: user.id,
        ...(query.jobId ? { id: String(query.jobId) } : {}),
        ...(query.search
          ? {
              title: {
                contains: String(query.search),
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      ...(status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: JOB_OWNER_APPLICATION_INCLUDE,
      }),
      this.prisma.application.count({ where }),
    ]);
    return paginated(
      rows.map((a) => mapJobOwnerApplicantListItem(a, 'worker-applicant')),
      total,
      page,
      limit,
    );
  }

  async applicantDetail(user: LocalAuthUser, applicationId: string) {
    const app = await this.findOwnedApplicantApplication(
      user.id,
      applicationId,
    );
    return mapJobOwnerApplicantDetail(app, 'worker-applicant', (job) =>
      this.mapPostedJobDetail(job),
    );
  }

  async updateApplicantStatus(
    user: LocalAuthUser,
    applicationId: string,
    body: Record<string, unknown>,
  ) {
    const current = await this.findOwnedApplicantApplication(
      user.id,
      applicationId,
    );
    const status = this.requiredEnum(ApplicationStatus, body.status, 'status');
    const app = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        employerNotes: maybeString(body.note) ?? current.employerNotes,
      },
      include: JOB_OWNER_APPLICATION_INCLUDE,
    });

    if (status === ApplicationStatus.HIRED) {
      await this.prisma.workEngagement.upsert({
        where: { applicationId },
        create: {
          applicationId,
          jobId: app.jobId,
          workerId: app.workerId,
          employerId: user.id,
          startDate: app.job.startDate ?? new Date(),
          roleLabel: app.job.title,
          employmentType: app.job.employmentType,
          payRate: app.job.payAmount,
          payCurrency: app.job.payCurrency,
          payStructure: app.job.payStructure,
          status: EngagementStatus.ACTIVE,
        },
        update: { status: EngagementStatus.ACTIVE },
      });
    }

    return mapJobOwnerApplicantDetail(app, 'worker-applicant', (job) =>
      this.mapPostedJobDetail(job),
    );
  }

  async updateApplicantNotes(
    user: LocalAuthUser,
    applicationId: string,
    body: Record<string, unknown>,
  ) {
    await this.findOwnedApplicantApplication(user.id, applicationId);
    const app = await this.prisma.application.update({
      where: { id: applicationId },
      data: { employerNotes: String(body.employerNotes ?? '') },
    });
    return { applicationId: app.id, employerNotes: app.employerNotes };
  }

  async downloadApplicantFile(
    user: LocalAuthUser,
    applicationId: string,
    fileIndex: number,
  ) {
    const app = await this.findOwnedApplicantApplication(
      user.id,
      applicationId,
    );
    const file = resolveApplicantFileByIndex(app, fileIndex);
    return this.fetchFileForDownload(file);
  }

  async downloadApplicationFile(
    user: LocalAuthUser,
    applicationId: string,
    fileIndex: number,
  ) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, workerId: user.id },
      include: {
        job: { select: { requiredSkills: true } },
      },
    });
    if (!app) throw new NotFoundException('Application not found.');
    const file = resolveApplicantFileByIndex(app, fileIndex);
    return this.fetchFileForDownload(file);
  }

  async savedJobs(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const where = { workerId: user.id };
    const [rows, total] = await Promise.all([
      this.prisma.savedJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            include: {
              department: true,
              owner: {
                include: { employerProfile: true, workerProfile: true },
              },
            },
          },
        },
      }),
      this.prisma.savedJob.count({ where }),
    ]);
    return paginated(
      rows.map((r) =>
        this.withSavedFlags(this.mapJobCard(r.job), rows, r.jobId, true),
      ),
      total,
      page,
      limit,
    );
  }

  async getApplicationProfile(user: LocalAuthUser, jobId: string) {
    const draft = await this.prisma.applicationProfileDraft.findUnique({
      where: { workerId_jobId: { workerId: user.id, jobId } },
    });
    if (!draft) {
      return { applicationId: null, jobId, customizedData: null };
    }
    return {
      id: draft.id,
      applicationId: null,
      jobId,
      profileId: (await this.requireWorker(user.id)).workerProfile!.id,
      customizedData: draft.customizedData,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  async upsertApplicationProfile(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, status: JobStatus.ACTIVE },
    });
    if (!job) throw new NotFoundException('Job not found.');
    const existing = await this.prisma.applicationProfileDraft.findUnique({
      where: { workerId_jobId: { workerId: user.id, jobId } },
    });
    const incoming = normalizeCustomizeBody(body);
    validateCustomizeProfileLimits(incoming);
    const customizedData = mergeCustomizeProfile(
      existing?.customizedData
        ? normalizeCustomizeBody(
            existing.customizedData as Record<string, unknown>,
          )
        : undefined,
      incoming,
    );
    const profile = (await this.requireWorker(user.id)).workerProfile!;
    const draft = await this.prisma.applicationProfileDraft.upsert({
      where: { workerId_jobId: { workerId: user.id, jobId } },
      create: {
        workerId: user.id,
        jobId,
        customizedData: customizedData as unknown as Prisma.InputJsonValue,
      },
      update: {
        customizedData: customizedData as unknown as Prisma.InputJsonValue,
      },
    });
    return {
      id: draft.id,
      applicationId: null,
      jobId,
      profileId: profile.id,
      customizedData: draft.customizedData,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  customizeApplicationProfile(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    return this.upsertApplicationProfile(user, jobId, body);
  }

  async applications(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(ApplicationStatus, query.status);
    const where = { workerId: user.id, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          job: {
            include: {
              department: true,
              owner: {
                include: { employerProfile: true, workerProfile: true },
              },
            },
          },
        },
      }),
      this.prisma.application.count({ where }),
    ]);
    return paginated(
      rows.map((a) => this.mapApplicationList(a)),
      total,
      page,
      limit,
    );
  }

  async applicationDetail(user: LocalAuthUser, applicationId: string) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, workerId: user.id },
      include: {
        job: {
          include: {
            department: true,
            owner: { include: { employerProfile: true, workerProfile: true } },
          },
        },
      },
    });
    if (!app) throw new NotFoundException('Application not found.');
    return this.mapApplicationDetail(app);
  }

  async deleteApplication(user: LocalAuthUser, applicationId: string) {
    await this.prisma.application.deleteMany({
      where: { id: applicationId, workerId: user.id },
    });
    return { ok: true };
  }

  async engagements(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(EngagementStatus, query.status);
    const where = { workerId: user.id, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.workEngagement.findMany({
        where,
        skip,
        take: limit,
        include: {
          job: true,
          employer: { include: { employerProfile: true } },
        },
      }),
      this.prisma.workEngagement.count({ where }),
    ]);
    return paginated(
      rows.map((e) => this.mapEngagement(e)),
      total,
      page,
      limit,
    );
  }

  async engagementDetail(user: LocalAuthUser, engagementId: string) {
    const row = await this.prisma.workEngagement.findFirst({
      where: { id: engagementId, workerId: user.id },
      include: {
        job: true,
        employer: { include: { employerProfile: true } },
        payments: true,
      },
    });
    if (!row) throw new NotFoundException('Engagement not found.');
    return {
      ...this.mapEngagement(row),
      description: row.job.description,
      taskNotes: row.taskNotes,
      terminationReason: row.terminationReason,
      payments: row.payments.map((p) => this.mapPayment(p, row)),
    };
  }

  async earningsSummary(user: LocalAuthUser) {
    const payments = await this.prisma.payment.findMany({
      where: { workerId: user.id },
    });
    return {
      total: payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((s, p) => s + Number(p.amount), 0),
      pending: payments
        .filter((p) => p.status === 'PENDING')
        .reduce((s, p) => s + Number(p.amount), 0),
      completed: payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((s, p) => s + Number(p.amount), 0),
      failed: payments
        .filter((p) => p.status === 'FAILED')
        .reduce((s, p) => s + Number(p.amount), 0),
      currency: 'XAF',
    };
  }

  async earningsTransactions(
    user: LocalAuthUser,
    query: Record<string, unknown>,
  ) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(EngagementStatus, query.status);
    void status;
    const where = { workerId: user.id };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { initiatedAt: 'desc' },
        include: {
          engagement: {
            include: {
              job: true,
              employer: { include: { employerProfile: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginated(
      rows.map((p) => this.mapPayment(p, p.engagement)),
      total,
      page,
      limit,
    );
  }

  async earningTransaction(user: LocalAuthUser, transactionId: string) {
    const p = await this.prisma.payment.findFirst({
      where: { id: transactionId, workerId: user.id },
      include: {
        engagement: {
          include: {
            job: true,
            employer: { include: { employerProfile: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Payment not found.');
    return {
      ...this.mapPayment(p, p.engagement),
      receiptNumber: p.receiptNumber,
      fapshiTransactionId: p.fapshiTransactionId,
      failureReason: p.failureReason,
    };
  }

  async profile(user: LocalAuthUser) {
    const full = await this.requireWorker(user.id);
    const [
      workExperiences,
      education,
      certifications,
      supportingDocuments,
      paymentAccounts,
      kyc,
    ] = await Promise.all([
      this.prisma.workExperience.findMany({ where: { workerId: user.id } }),
      this.prisma.education.findMany({ where: { workerId: user.id } }),
      this.prisma.certification.findMany({ where: { workerId: user.id } }),
      this.prisma.supportingDocument.findMany({ where: { workerId: user.id } }),
      this.prisma.workerPaymentAccount.findMany({
        where: { workerId: user.id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.kycSubmission.findFirst({
        where: { workerId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const p = full.workerProfile!;
    const breakdown = this.parseBreakdown(p.profileCompletenessBreakdown);
    const paymentMethods = paymentAccounts.map((a) => ({
      id: a.id,
      provider: providerToApi(a.provider),
      phoneNumber: a.phoneNumber,
      isPrimary: a.isPrimary,
      createdAt: a.createdAt.toISOString(),
    }));
    return {
      id: p.id,
      userId: full.id,
      email: full.email,
      phone: full.phone,
      photoUrl: full.photoUrl,
      fullName: p.fullName,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      professionalTitle: p.professionalTitle,
      shortBio: p.shortBio,
      country: p.country,
      region: p.region,
      city: p.city,
      languages: p.languages,
      skills: p.skills,
      preferredJobCategories: p.preferredJobCategories,
      preferredJobTypes: p.preferredJobTypes.map(employmentTypeToApi),
      availabilityStatus: p.availabilityStatus,
      availableForHire: deriveAvailableForHire(p.availabilityStatus),
      yearsExperienceByCategory: p.yearsExperienceByCategory,
      cvUrl: p.cvUrl,
      profileCompleteness: p.profileCompleteness,
      profileCompletenessBreakdown: breakdown,
      profileStrengthBreakdown: breakdown,
      verificationStatus: verificationToApi(p.verificationStatus),
      workExperiences: sortWorkOrEducationDesc(workExperiences),
      education: sortWorkOrEducationDesc(education),
      certifications: sortCertificationsDesc(certifications),
      supportingDocuments: supportingDocuments.map((d) =>
        this.mapSupportingDocument(d),
      ),
      paymentMethods,
      paymentAccounts: paymentMethods,
      latestKyc: kyc
        ? {
            ...kyc,
            status: verificationToApi(kyc.status),
            kycType: kyc.kycType.toLowerCase(),
          }
        : { status: 'not_submitted' },
    };
  }

  async publicProfile(workerProfileId: string) {
    const profile = await this.prisma.workerProfile.findUnique({
      where: { id: workerProfileId },
      include: {
        user: {
          include: {
            workExperiences: true,
            educationItems: true,
            certifications: true,
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Worker profile not found.');
    const workExperiences = sortWorkOrEducationDesc(
      profile.user.workExperiences,
    );
    const education = sortWorkOrEducationDesc(profile.user.educationItems);
    const certifications = sortCertificationsDesc(profile.user.certifications);
    return {
      id: profile.id,
      fullName: profile.fullName,
      professionalTitle: profile.professionalTitle,
      shortBio: profile.shortBio,
      city: profile.city,
      region: profile.region,
      country: profile.country,
      photoUrl: profile.user.photoUrl,
      skills: profile.skills,
      languages: profile.languages,
      availabilityStatus: profile.availabilityStatus,
      availableForHire: deriveAvailableForHire(profile.availabilityStatus),
      verificationStatus: verificationToApi(profile.verificationStatus),
      profileCompleteness: profile.profileCompleteness,
      workExperiences,
      education,
      certifications,
    };
  }

  async listPaymentAccounts(user: LocalAuthUser) {
    const rows = await this.prisma.workerPaymentAccount.findMany({
      where: { workerId: user.id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((a) => ({
      id: a.id,
      provider: providerToApi(a.provider),
      phoneNumber: a.phoneNumber,
      isPrimary: a.isPrimary,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async updateProfile(user: LocalAuthUser, body: Record<string, unknown>) {
    if ('availableForHire' in body) {
      throw new BadRequestException(
        'availableForHire is read-only. Update availabilityStatus instead.',
      );
    }
    await this.prisma.workerProfile.update({
      where: { userId: user.id },
      data: {
        fullName: maybeString(body.fullName),
        firstName: maybeString(body.firstName),
        lastName: maybeString(body.lastName),
        dateOfBirth: body.dateOfBirth
          ? new Date(String(body.dateOfBirth))
          : undefined,
        professionalTitle: maybeString(body.professionalTitle),
        shortBio: maybeString(body.shortBio),
        country: maybeString(body.country),
        region: maybeString(body.region),
        city: maybeString(body.city),
        languages: maybeStringArray(body.languages),
        skills: maybeStringArray(body.skills),
        preferredJobCategories: maybeStringArray(body.preferredJobCategories),
        preferredJobTypes: maybeStringArray(body.preferredJobTypes)
          ?.map((v) => parseEnum(EmploymentType, v))
          .filter(Boolean) as EmploymentType[] | undefined,
        availabilityStatus: maybeString(body.availabilityStatus),
        yearsExperienceByCategory: body.yearsExperienceByCategory as
          | object
          | undefined,
      },
    });
    await this.recomputeCompleteness(user.id);
    return this.profile(user);
  }

  async uploadAvatar(user: LocalAuthUser, url: string) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { photoUrl: url },
    });
    await this.recomputeCompleteness(user.id);
    return this.profile(user);
  }

  async uploadCv(user: LocalAuthUser, url: string) {
    await this.prisma.workerProfile.update({
      where: { userId: user.id },
      data: { cvUrl: url },
    });
    return { cvUrl: url, message: 'CV uploaded.' };
  }

  async createWorkExperience(
    user: LocalAuthUser,
    body: Record<string, unknown>,
  ) {
    const row = await this.prisma.workExperience.create({
      data: {
        workerId: user.id,
        companyName: String(body.companyName ?? body.company ?? ''),
        companyWebsite: maybeString(body.companyWebsite),
        jobTitle: String(body.jobTitle ?? body.role ?? ''),
        location: maybeString(body.location),
        startDate: new Date(String(body.startDate)),
        endDate: body.endDate ? new Date(String(body.endDate)) : undefined,
        isCurrent: Boolean(body.isCurrent),
        description: maybeString(body.description),
      },
    });
    await this.recomputeCompleteness(user.id);
    return row;
  }

  async updateWorkExperience(
    user: LocalAuthUser,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.prisma.workExperience.updateMany({
      where: { id, workerId: user.id },
      data: {
        companyName: maybeString(body.companyName),
        jobTitle: maybeString(body.jobTitle),
        location: maybeString(body.location),
        description: maybeString(body.description),
      },
    });
    await this.recomputeCompleteness(user.id);
    return this.profile(user);
  }

  async deleteOwned(
    model:
      | 'workExperience'
      | 'education'
      | 'certification'
      | 'supportingDocument'
      | 'workerPaymentAccount',
    user: LocalAuthUser,
    id: string,
  ) {
    await (this.prisma[model] as any).deleteMany({
      where: { id, workerId: user.id },
    });
    await this.recomputeCompleteness(user.id);
    return { ok: true };
  }

  async createEducation(user: LocalAuthUser, body: Record<string, unknown>) {
    const row = await this.prisma.education.create({
      data: {
        workerId: user.id,
        institutionName: String(
          body.institutionName ?? body.institution ?? body.school ?? '',
        ),
        institutionWebsite: maybeString(body.institutionWebsite),
        country: maybeString(body.country),
        region: maybeString(body.region),
        city: maybeString(body.city),
        degree: maybeString(body.degree),
        fieldOfStudy: maybeString(body.fieldOfStudy),
        startDate: new Date(String(body.startDate)),
        endDate: body.endDate ? new Date(String(body.endDate)) : undefined,
        isCurrent: Boolean(body.isCurrent),
        description: maybeString(body.description),
      },
    });
    await this.recomputeCompleteness(user.id);
    return row;
  }

  async updateEducation(
    user: LocalAuthUser,
    id: string,
    body: Record<string, unknown>,
  ) {
    await this.prisma.education.updateMany({
      where: { id, workerId: user.id },
      data: {
        institutionName: maybeString(body.institutionName),
        degree: maybeString(body.degree),
        fieldOfStudy: maybeString(body.fieldOfStudy),
        description: maybeString(body.description),
      },
    });
    await this.recomputeCompleteness(user.id);
    return this.profile(user);
  }

  async createCertification(
    user: LocalAuthUser,
    body: Record<string, unknown>,
  ) {
    if (!String(body.name ?? '').trim()) {
      throw new BadRequestException('name is required.');
    }
    const credentialUrl = validateCredentialUrl(body.credentialUrl);
    const row = await this.prisma.certification.create({
      data: {
        workerId: user.id,
        name: String(body.name ?? ''),
        issuer: maybeString(body.issuer),
        description: maybeString(body.description),
        credentialUrl,
        issueDate: body.issueDate
          ? new Date(String(body.issueDate))
          : undefined,
        expiryDate: body.expiryDate
          ? new Date(String(body.expiryDate))
          : undefined,
      },
    });
    await this.recomputeCompleteness(user.id);
    return row;
  }

  async updateCertification(
    user: LocalAuthUser,
    id: string,
    body: Record<string, unknown>,
  ) {
    const credentialUrl =
      body.credentialUrl !== undefined
        ? validateCredentialUrl(body.credentialUrl)
        : undefined;
    await this.prisma.certification.updateMany({
      where: { id, workerId: user.id },
      data: {
        name: maybeString(body.name),
        issuer: maybeString(body.issuer),
        description: maybeString(body.description),
        credentialUrl,
        issueDate: body.issueDate
          ? new Date(String(body.issueDate))
          : undefined,
        expiryDate: body.expiryDate
          ? new Date(String(body.expiryDate))
          : undefined,
      },
    });
    await this.recomputeCompleteness(user.id);
    return this.profile(user);
  }

  async createDocument(
    user: LocalAuthUser,
    file: Express.Multer.File,
    url: string,
    label?: string,
  ) {
    return this.prisma.supportingDocument.create({
      data: {
        workerId: user.id,
        fileUrl: url,
        fileName: file.originalname,
        fileType: fileTypeFromMime(file.mimetype),
        documentLabel: label,
      },
    });
  }

  async listDocuments(user: LocalAuthUser) {
    const rows = await this.prisma.supportingDocument.findMany({
      where: { workerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => this.mapSupportingDocument(d));
  }

  async submitKyc(user: LocalAuthUser, body: Record<string, unknown>) {
    const kycType = parseEnum(KycType, body.kycType);
    if (!kycType) throw new BadRequestException('Invalid KYC type.');
    const row = await this.prisma.kycSubmission.create({
      data: {
        workerId: user.id,
        kycType,
        frontUrl: String(body.frontUrl),
        backUrl: maybeString(body.backUrl),
        selfieUrl: String(body.selfieUrl),
        status: VerificationStatus.PENDING,
      },
    });
    await this.prisma.workerProfile.update({
      where: { userId: user.id },
      data: { verificationStatus: VerificationStatus.PENDING },
    });
    await this.recomputeCompleteness(user.id);
    await emitWorkerNotification(this.prisma, {
      userId: user.id,
      type: NotificationType.VERIFICATION_UPDATE,
      title: 'KYC submitted',
      body: 'Your identity documents are under review.',
      relatedType: 'kyc',
      relatedId: row.id,
    });
    return {
      ...row,
      status: verificationToApi(row.status),
      kycType: row.kycType.toLowerCase(),
    };
  }

  async kycStatus(user: LocalAuthUser) {
    const row = await this.prisma.kycSubmission.findFirst({
      where: { workerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      return { status: 'not_submitted' };
    }
    return {
      ...row,
      status: verificationToApi(row.status),
      kycType: row.kycType.toLowerCase(),
    };
  }

  async createPaymentAccount(
    user: LocalAuthUser,
    body: Record<string, unknown>,
  ) {
    const provider = parseEnum(MomoProvider, body.provider);
    if (!provider) throw new BadRequestException('Invalid provider.');
    const phoneNumber = String(body.phoneNumber ?? body.phone ?? '').trim();
    if (!phoneNumber) throw new BadRequestException('phoneNumber is required.');
    const isPrimary = Boolean(body.isPrimary);
    if (isPrimary) {
      await this.prisma.workerPaymentAccount.updateMany({
        where: { workerId: user.id },
        data: { isPrimary: false },
      });
    }
    const count = await this.prisma.workerPaymentAccount.count({
      where: { workerId: user.id },
    });
    return this.prisma.workerPaymentAccount.create({
      data: {
        workerId: user.id,
        provider,
        phoneNumber,
        isPrimary: isPrimary || count === 0,
      },
    });
  }

  async updatePaymentAccount(
    user: LocalAuthUser,
    id: string,
    body: Record<string, unknown>,
  ) {
    const phoneNumber =
      body.phoneNumber !== undefined || body.phone !== undefined
        ? String(body.phoneNumber ?? body.phone).trim()
        : undefined;
    const isPrimary =
      body.isPrimary === undefined ? undefined : Boolean(body.isPrimary);
    if (isPrimary) {
      await this.prisma.workerPaymentAccount.updateMany({
        where: { workerId: user.id },
        data: { isPrimary: false },
      });
    }
    await this.prisma.workerPaymentAccount.updateMany({
      where: { id, workerId: user.id },
      data: {
        phoneNumber,
        isPrimary,
      },
    });
    return this.profile(user);
  }

  async informalRequests(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(InformalRequestStatus, query.status);
    const where = { requesterId: user.id, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.informalJobRequest.findMany({
        where,
        skip,
        take: limit,
        include: { department: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.informalJobRequest.count({ where }),
    ]);
    return paginated(
      rows.map((r) => this.mapInformalRequest(r)),
      total,
      page,
      limit,
    );
  }

  async createInformalRequest(
    user: LocalAuthUser,
    body: Record<string, unknown>,
  ) {
    const category = parseEnum(DepartmentCategory, body.departmentCategory);
    if (!category)
      throw new BadRequestException('Invalid department category.');
    const row = await this.prisma.informalJobRequest.create({
      data: {
        requesterId: user.id,
        departmentId: String(body.departmentId),
        departmentCategory: category,
        formData: (body.formData as object) ?? {},
        paymentManagedByJoballa: Boolean(body.paymentManagedByJoballa),
        status: InformalRequestStatus.SUBMITTED,
      },
      include: { department: true },
    });
    return { ...this.mapInformalRequest(row), message: 'Request submitted.' };
  }

  async notifications(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const type = parseEnum(NotificationType, query.type);
    const where = {
      userId: user.id,
      ...(type ? { type } : {}),
      ...(query.unreadOnly ? { isRead: false } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginated(
      rows.map((n) => this.mapNotification(n)),
      total,
      page,
      limit,
    );
  }

  async markNotificationRead(user: LocalAuthUser, id: string) {
    const row = await this.prisma.notification.update({
      where: { id, userId: user.id },
      data: { isRead: true },
    });
    return this.mapNotification(row);
  }

  async unreadNotificationCount(user: LocalAuthUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
    return { count };
  }

  async markAllNotificationsRead(user: LocalAuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async notificationSettings(user: LocalAuthUser) {
    const row = await this.prisma.notificationSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return this.mapNotificationSettings(row);
  }

  async updateNotificationSettings(
    user: LocalAuthUser,
    body: Record<string, unknown>,
  ) {
    const row = await this.prisma.notificationSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...body },
      update: body,
    });
    return this.mapNotificationSettings(row);
  }

  async updateLanguage(user: LocalAuthUser, body: Record<string, unknown>) {
    const preferredLanguage =
      String(body.preferredLanguage).toLowerCase() === 'fre'
        ? PreferredLanguage.FRE
        : PreferredLanguage.ENG;
    const row = await this.prisma.user.update({
      where: { id: user.id },
      data: { preferredLanguage },
    });
    return { preferredLanguage: languageToApi(row.preferredLanguage) };
  }

  private requiredEnum<T extends Record<string, string>>(
    enumObject: T,
    value: unknown,
    field: string,
  ): T[keyof T] {
    const parsed = parseEnum(enumObject, value);
    if (!parsed) throw new BadRequestException(`Invalid ${field}.`);
    return parsed;
  }

  private postedJobInclude() {
    return {
      department: true,
      applications: true,
      _count: { select: { applications: true } },
    } as const;
  }

  private async findOwnedPostedJob(ownerId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, ownerId },
      include: this.postedJobInclude(),
    });
    if (!job) throw new NotFoundException('Job not found.');
    return job;
  }

  private async findOwnedApplicantApplication(
    ownerId: string,
    applicationId: string,
  ) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, job: { ownerId } },
      include: JOB_OWNER_APPLICATION_INCLUDE,
    });
    if (!app) throw new NotFoundException('Applicant not found.');
    return app;
  }

  private async fetchFileForDownload(file: {
    name: string;
    fileName?: string;
    url?: string;
    type?: string;
  }) {
    const url = file.url;
    if (!url) throw new NotFoundException('File URL missing.');
    const response = await fetch(url);
    if (!response.ok) {
      throw new NotFoundException('File could not be retrieved.');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const fileName = file.fileName ?? file.name ?? 'document';
    const contentType =
      response.headers.get('content-type') ??
      (file.type === 'pdf' ? 'application/pdf' : 'application/octet-stream');
    return { buffer, fileName, contentType };
  }

  private async loadJobRejectionReason(jobId: string): Promise<string | null> {
    const row = await this.prisma.rejectionReason.findFirst({
      where: { targetType: SubmissionTargetType.JOB, targetId: jobId },
      orderBy: { createdAt: 'desc' },
    });
    return row?.reasonText ?? null;
  }

  private jobOwnerEngagementInclude() {
    return {
      job: true,
      worker: { include: { workerProfile: true, workerPaymentAccounts: true } },
      application: true,
    } as const;
  }

  private mapJobOwnerWorkforce(e: any) {
    const workerName =
      e.worker.workerProfile?.fullName ??
      e.worker.email ??
      e.worker.phone ??
      'Worker';
    return {
      id: e.workerId,
      engagementId: e.id,
      workerId: e.workerId,
      workerName,
      workerPhotoUrl: e.worker.photoUrl,
      jobId: e.jobId,
      jobTitle: e.job.title,
      roleLabel: e.roleLabel,
      startDate: e.startDate.toISOString().slice(0, 10),
      endDate: e.endDate?.toISOString().slice(0, 10) ?? null,
      status: engagementStatusToApi(e.status),
      payRate: e.payRate,
      payCurrency: e.payCurrency,
      payStructure: payStructureToApi(e.payStructure),
      paymentManagedByJoballa: e.job.paymentManagedByJoballa,
    };
  }

  private mapJobOwnerPayment(p: any, engagement: any) {
    const workerName =
      engagement.worker.workerProfile?.fullName ??
      engagement.worker.email ??
      engagement.worker.phone ??
      'Worker';
    return {
      id: p.id,
      engagementId: p.engagementId,
      workerId: p.workerId,
      workerName,
      jobTitle: engagement.job.title,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status.toLowerCase(),
      provider: providerToApi(p.mobileMoneyProvider),
      initiatedAt: p.initiatedAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null,
    };
  }

  private mapPostedJobCard(job: any, rejectionReason: string | null = null) {
    const submitted =
      job.applications?.filter(
        (a: { status: ApplicationStatus }) =>
          a.status === ApplicationStatus.SUBMITTED,
      ).length ?? 0;
    const shortlisted =
      job.applications?.filter(
        (a: { status: ApplicationStatus }) =>
          a.status === ApplicationStatus.SHORTLISTED,
      ).length ?? 0;
    const hired =
      job.applications?.filter(
        (a: { status: ApplicationStatus }) =>
          a.status === ApplicationStatus.HIRED,
      ).length ?? 0;
    return {
      id: job.id,
      title: job.title,
      departmentId: job.departmentId,
      department: job.department
        ? {
            id: job.department.id,
            name: job.department.name,
            slug: job.department.slug,
            category: departmentCategoryToApi(job.department.category),
          }
        : null,
      city: job.city,
      region: job.region,
      country: job.country,
      neighbourhood: job.neighbourhood ?? null,
      employmentType: employmentTypeToApi(job.employmentType),
      workMode: workModeToApi(job.workMode),
      experienceLevel: job.experienceLevel?.toLowerCase() ?? null,
      payAmount: job.payAmount,
      payCurrency: job.payCurrency,
      payStructure: payStructureToApi(job.payStructure),
      status: jobStatusToApi(job.status),
      postedByType: jobPostedByTypeToApi(job.postedByType),
      paymentManagedByJoballa: job.paymentManagedByJoballa,
      applicantsCount:
        job._count?.applications ?? submitted + shortlisted + hired,
      shortlistedCount: shortlisted,
      hiredCount: hired,
      rejectionReason,
      changeRequest: null,
      createdAt: job.createdAt.toISOString(),
      approvedAt: job.approvedAt?.toISOString() ?? null,
    };
  }

  private mapPostedJobDetail(job: any, rejectionReason: string | null = null) {
    return {
      ...this.mapPostedJobCard(job, rejectionReason),
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities,
      requiredSkills: job.requiredSkills,
      requestedDocuments: job.requestedDocuments ?? [],
      numberOfOpenings: job.numberOfOpenings,
      duration: job.duration ?? null,
      startDate: job.startDate?.toISOString().slice(0, 10) ?? null,
      startNow: job.startNow,
      adminNotes: job.adminNotes,
    };
  }

  private async requireWorker(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { workerProfile: true },
    });
    if (!user || user.role !== Role.WORKER)
      throw new ForbiddenException('Worker account required.');
    if (!user.workerProfile)
      throw new ForbiddenException('Worker profile missing.');
    return user;
  }

  private mapJobCard(job: any) {
    return {
      id: job.id,
      title: job.title,
      department: job.department
        ? {
            id: job.department.id,
            name: job.department.name,
            slug: job.department.slug,
            category: departmentCategoryToApi(job.department.category),
          }
        : null,
      ownerName: this.ownerName(job),
      ownerVerified: this.ownerVerified(job),
      city: job.city,
      region: job.region,
      country: job.country,
      employmentType: employmentTypeToApi(job.employmentType),
      workMode: workModeToApi(job.workMode),
      payAmount: job.payAmount,
      payCurrency: job.payCurrency,
      payStructure: payStructureToApi(job.payStructure),
      duration: job.duration,
      status: jobStatusToApi(job.status),
      postedByType: jobPostedByTypeToApi(job.postedByType),
      paymentManagedByJoballa: job.paymentManagedByJoballa,
      requiredSkills: job.requiredSkills,
      matchScore: null,
      postedAt: job.createdAt.toISOString(),
    };
  }

  private ownerName(job: any) {
    return (
      job.owner?.employerProfile?.companyName ??
      job.owner?.workerProfile?.fullName ??
      job.owner?.email ??
      job.owner?.phone ??
      'Joballa user'
    );
  }

  private ownerVerified(job: any) {
    if (job.owner?.employerProfile) {
      return (
        job.owner.employerProfile.verificationStatus ===
        VerificationStatus.VERIFIED
      );
    }
    return (
      job.owner?.workerProfile?.verificationStatus ===
      VerificationStatus.VERIFIED
    );
  }

  private mapApplicationList(app: any) {
    return {
      id: app.id,
      status: applicationStatusToApi(app.status),
      submittedAt: app.submittedAt.toISOString(),
      job: this.mapJobCard(app.job),
      employerNotes: app.employerNotes,
    };
  }

  private mapApplicationDetail(app: any) {
    const profileSnapshot = normalizeApplicantProfileSnapshot(
      app.profileSnapshot,
      {
        snapshotOnly: true,
        jobRequiredSkills: app.job?.requiredSkills ?? [],
      },
    );
    const attachedDocuments = enrichApplicantDocuments(
      normalizeAttachedDocuments(app.attachedDocuments),
      { scope: 'worker-application', applicationId: app.id },
    );
    const documents = enrichApplicantDocuments(
      mergeApplicantDocuments(profileSnapshot, app.attachedDocuments),
      { scope: 'worker-application', applicationId: app.id },
    );
    return {
      ...this.mapApplicationList(app),
      jobId: app.jobId,
      workerId: app.workerId,
      coverNote: app.coverNote,
      attachedDocuments,
      profileSnapshot: { ...profileSnapshot, documents },
    };
  }

  private mapEngagement(e: any) {
    return {
      id: e.id,
      engagementId: e.id,
      jobId: e.jobId,
      jobTitle: e.job.title,
      payerName: this.ownerName({ owner: e.employer }),
      startDate: e.startDate.toISOString().slice(0, 10),
      endDate: e.endDate?.toISOString().slice(0, 10) ?? null,
      status: engagementStatusToApi(e.status),
      payRate: e.payRate,
      payCurrency: e.payCurrency,
      payStructure: payStructureToApi(e.payStructure),
      paymentManagedByJoballa: e.job.paymentManagedByJoballa,
    };
  }

  private mapPayment(p: any, engagement: any) {
    return {
      id: p.id,
      engagementId: p.engagementId,
      jobTitle: engagement.job.title,
      payerName: this.ownerName({ owner: engagement.employer }),
      amount: Number(p.amount),
      currency: p.currency,
      provider: providerToApi(p.mobileMoneyProvider),
      recipientNumber: p.recipientNumber,
      status: p.status.toLowerCase(),
      initiatedAt: p.initiatedAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null,
    };
  }

  private mapInformalRequest(r: any) {
    return {
      id: r.id,
      department: {
        id: r.department.id,
        name: r.department.name,
        category: departmentCategoryToApi(r.department.category),
      },
      title: String(
        r.formData?.title ?? r.formData?.subject ?? r.department.name,
      ),
      paymentManagedByJoballa: r.paymentManagedByJoballa,
      status: informalStatusToApi(r.status),
      assignedJobId: r.assignedJobId,
      rejectionReason: null,
      changeRequest: null,
      createdAt: r.createdAt.toISOString(),
      submissionScore: undefined,
    };
  }

  private mapNotification(n: any) {
    return {
      id: n.id,
      type: notificationApiType(n.type),
      title: n.title,
      body: n.body,
      read: n.isRead,
      isRead: n.isRead,
      deepLink: notificationDeepLink(n.type, n.relatedType, n.relatedId),
      metadata:
        n.relatedId || n.relatedType
          ? { relatedId: n.relatedId, relatedType: n.relatedType }
          : undefined,
      createdAt: n.createdAt.toISOString(),
    };
  }

  private mapSupportingDocument(d: {
    id: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    documentLabel?: string | null;
    createdAt: Date;
  }) {
    const mimeType =
      d.fileType === 'PDF'
        ? 'application/pdf'
        : d.fileType === 'IMAGE'
          ? 'image/jpeg'
          : undefined;
    return {
      id: d.id,
      type: d.documentLabel?.toUpperCase() ?? 'OTHER',
      fileName: d.fileName,
      url: d.fileUrl,
      mimeType,
      fileType: documentTypeToApi(d.fileType as never),
      createdAt: d.createdAt.toISOString(),
    };
  }

  private withSavedFlags<T extends { id: string }>(
    card: T,
    savedRows: Array<{ jobId: string }>,
    jobId: string,
    forceSaved = false,
  ) {
    const savedSet = new Set(savedRows.map((s) => s.jobId));
    const saved = forceSaved || savedSet.has(jobId);
    return {
      ...card,
      saved,
      isSaved: saved,
      savedByViewer: saved,
      hiddenByViewer: false,
    };
  }

  private parseBreakdown(value: unknown) {
    const empty = {
      personalInfo: 0,
      summary: 0,
      skills: 0,
      experience: 0,
      education: 0,
      certifications: 0,
      verification: 0,
      languages: 0,
    };
    if (!value || typeof value !== 'object') return empty;
    const v = value as Record<string, number>;
    return {
      personalInfo: Number(v.personalInfo) || 0,
      summary: Number(v.summary) || 0,
      skills: Number(v.skills) || 0,
      experience: Number(v.experience) || 0,
      education: Number(v.education) || 0,
      certifications: Number(v.certifications) || 0,
      verification: Number(v.verification) || 0,
      languages: Number(v.languages) || 0,
    };
  }

  private mapNotificationSettings(s: any) {
    return {
      inAppEnabled: s.inAppEnabled,
      emailEnabled: s.emailEnabled,
      smsEnabled: s.smsEnabled,
      applicationUpdates: s.applicationUpdates,
      jobUpdates: s.jobUpdates,
      paymentUpdates: s.paymentUpdates,
      engagementUpdates: s.engagementUpdates,
      securityAlerts: s.securityAlerts,
      marketingUpdates: s.marketingUpdates,
    };
  }

  private async recomputeCompleteness(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workerProfile: true,
        _count: {
          select: {
            workExperiences: true,
            educationItems: true,
            certifications: true,
          },
        },
      },
    });
    const p = user?.workerProfile;
    if (!p) return;
    const { profileCompleteness, profileStrengthBreakdown } =
      computeWeightedProfileCompleteness({
        fullName: p.fullName,
        email: user.email,
        phone: user.phone,
        photoUrl: user.photoUrl,
        city: p.city,
        region: p.region,
        professionalTitle: p.professionalTitle,
        shortBio: p.shortBio,
        skills: p.skills,
        languages: p.languages,
        verificationStatus: p.verificationStatus,
        workExperienceCount: user._count.workExperiences,
        educationCount: user._count.educationItems,
        certificationCount: user._count.certifications,
      });
    await this.prisma.workerProfile.update({
      where: { userId },
      data: {
        profileCompleteness,
        profileCompletenessBreakdown:
          profileStrengthBreakdown as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

function parseApplicationSource(value: unknown): ApplicationSource | null {
  const source = String(value || '')
    .toLowerCase()
    .trim();
  if (source === 'mobile_app' || source === 'mobile') {
    return ApplicationSource.MOBILE_APP;
  }
  return null;
}

function maybeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function maybeStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.map(String) : undefined;
}
