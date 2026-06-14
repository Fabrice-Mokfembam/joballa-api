import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  DepartmentCategory,
  DocumentFileType,
  EmploymentType,
  EngagementStatus,
  ExperienceLevel,
  InformalRequestStatus,
  JobStatus,
  JobPostedByType,
  MomoProvider,
  NotificationType,
  PaymentStatus,
  PayStructure,
  PreferredLanguage,
  Role,
  SubmissionTargetType,
  SubmissionTier,
  VerificationStatus,
  WorkMode,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { resolveApplicantFileByIndex } from '../shared/applicant-file.util';
import {
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
  departmentCategoryToApi,
  documentTypeToApi,
  employmentTypeToApi,
  engagementStatusToApi,
  fileTypeFromMime,
  informalStatusToApi,
  jobPostedByTypeToApi,
  jobStatusToApi,
  languageToApi,
  notificationTypeToApi,
  pageParams,
  paginated,
  parseEnum,
  payStructureToApi,
  providerToApi,
  tierToApi,
  verificationToApi,
  workModeToApi,
} from '../shared/api-format';

@Injectable()
export class EmployerV2Service {
  constructor(private readonly prisma: PrismaService) {}

  async me(user: LocalAuthUser) {
    const full = await this.requireEmployer(user.id);
    return {
      id: full.id,
      email: full.email,
      phone: full.phone,
      role: 'employer',
      preferredLanguage: languageToApi(full.preferredLanguage),
      accountStatus: accountStatusToApi(full.accountStatus),
      employerProfile: {
        id: full.employerProfile!.id,
        companyName: full.employerProfile!.companyName,
        companyLogoUrl: full.employerProfile!.companyLogoUrl,
        contactPersonName: full.employerProfile!.contactPersonName,
        verificationStatus: verificationToApi(
          full.employerProfile!.verificationStatus,
        ),
      },
    };
  }

  async dashboard(user: LocalAuthUser) {
    const [me, activeJobs, recentApplicants, payments] = await Promise.all([
      this.me(user),
      this.prisma.job.findMany({
        where: { ownerId: user.id, status: JobStatus.ACTIVE },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: this.jobInclude(),
      }),
      this.prisma.application.findMany({
        where: { job: { ownerId: user.id } },
        take: 5,
        orderBy: { submittedAt: 'desc' },
        include: this.applicationInclude(),
      }),
      this.prisma.payment.findMany({ where: { payerId: user.id } }),
    ]);

    return {
      companyName: me.employerProfile.companyName,
      verificationStatus: me.employerProfile.verificationStatus,
      stats: {
        activeJobs: activeJobs.length,
        totalApplicants: await this.prisma.application.count({
          where: { job: { ownerId: user.id } },
        }),
        hiredWorkers: await this.prisma.workEngagement.count({
          where: { employerId: user.id },
        }),
        totalPayroll: payments
          .filter((p) => p.status === PaymentStatus.COMPLETED)
          .reduce((sum, p) => sum + Number(p.amount), 0),
        currency: 'XAF',
      },
      activeJobs: activeJobs.map((j) => this.mapJobCard(j)),
      recentApplicants: recentApplicants.map((a) =>
        mapJobOwnerApplicantListItem(a, 'employer-applicant'),
      ),
      nextActions: [
        { key: 'post_job', label: 'Post a job', href: '/employer/jobs/new' },
        {
          key: 'applicants',
          label: 'View applicants',
          href: '/employer/applicants',
        },
        {
          key: 'need_someone',
          label: 'Need someone?',
          href: '/employer/requests/new',
        },
      ],
    };
  }

  async jobs(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(JobStatus, query.status);
    const where = {
      ownerId: user.id,
      ...(status ? { status } : {}),
      ...(query.search
        ? {
            title: {
              contains: String(query.search),
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.jobInclude(),
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginated(
      rows.map((j) => this.mapJobCard(j)),
      total,
      page,
      limit,
    );
  }

  async departments(user: LocalAuthUser, query: Record<string, unknown>) {
    await this.requireEmployer(user.id);
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

  async createJob(user: LocalAuthUser, body: Record<string, unknown>) {
    await this.requireEmployer(user.id);
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
        postedByType: JobPostedByType.COMPANY,
        paymentManagedByJoballa: Boolean(body.paymentManagedByJoballa),
      },
      include: this.jobInclude(),
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
      rejectionReason: null,
      changeRequest: null,
      message: isDraft
        ? 'Job saved as draft.'
        : 'Job submitted. Joballa admin will review before going live.',
    };
  }

  async jobDetail(user: LocalAuthUser, jobId: string) {
    const job = await this.findOwnedJob(user.id, jobId);
    return this.mapJobDetail(job);
  }

  async publishJob(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown> = {},
  ) {
    const current = await this.findOwnedJob(user.id, jobId);
    assertPublishableStatus(current.status);

    if (Object.keys(body).length > 0) {
      await this.updateJob(user, jobId, body);
    }

    const job = await this.findOwnedJob(user.id, jobId);
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
      include: this.jobInclude(),
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

  async updateJob(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    await this.findOwnedJob(user.id, jobId);
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
      include: this.jobInclude(),
    });
    return this.mapJobDetail(job);
  }

  async updateJobStatus(
    user: LocalAuthUser,
    jobId: string,
    body: Record<string, unknown>,
  ) {
    const current = await this.findOwnedJob(user.id, jobId);
    const status = this.requiredEnum(JobStatus, body.status, 'status');
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
      include: this.jobInclude(),
    });
    return this.mapJobDetail(job);
  }

  async deleteJob(user: LocalAuthUser, jobId: string) {
    await this.prisma.job.deleteMany({
      where: { id: jobId, ownerId: user.id },
    });
    return { ok: true };
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
        include: this.applicationInclude(),
      }),
      this.prisma.application.count({ where }),
    ]);
    return paginated(
      rows.map((a) => mapJobOwnerApplicantListItem(a, 'employer-applicant')),
      total,
      page,
      limit,
    );
  }

  async applicantDetail(user: LocalAuthUser, applicationId: string) {
    const app = await this.findOwnedApplication(user.id, applicationId);
    return mapJobOwnerApplicantDetail(app, 'employer-applicant', (job) =>
      this.mapJobDetail(job),
    );
  }

  async downloadApplicantFile(
    user: LocalAuthUser,
    applicationId: string,
    fileIndex: number,
  ) {
    const app = await this.findOwnedApplication(user.id, applicationId);
    const file = resolveApplicantFileByIndex(app, fileIndex);
    return this.fetchFileForDownload(file);
  }

  async updateApplicantStatus(
    user: LocalAuthUser,
    applicationId: string,
    body: Record<string, unknown>,
  ) {
    const current = await this.findOwnedApplication(user.id, applicationId);
    const status = this.requiredEnum(ApplicationStatus, body.status, 'status');
    const app = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        employerNotes: maybeString(body.note) ?? current.employerNotes,
      },
      include: this.applicationInclude(),
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

    return mapJobOwnerApplicantDetail(app, 'employer-applicant', (job) =>
      this.mapJobDetail(job),
    );
  }

  async updateApplicantNotes(
    user: LocalAuthUser,
    applicationId: string,
    body: Record<string, unknown>,
  ) {
    await this.findOwnedApplication(user.id, applicationId);
    const app = await this.prisma.application.update({
      where: { id: applicationId },
      data: { employerNotes: String(body.employerNotes ?? '') },
    });
    return { applicationId: app.id, employerNotes: app.employerNotes };
  }

  shareApplicant(applicationId: string) {
    return { url: `https://joballa.com/employer/applicants/${applicationId}` };
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
        include: this.engagementInclude(),
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.workEngagement.count({ where }),
    ]);
    return paginated(
      rows.map((e) => this.mapWorkforce(e)),
      total,
      page,
      limit,
    );
  }

  async workforceDetail(user: LocalAuthUser, workerId: string) {
    const row = await this.prisma.workEngagement.findFirst({
      where: { employerId: user.id, workerId },
      include: { ...this.engagementInclude(), payments: true },
      orderBy: { startedAt: 'desc' },
    });
    if (!row) throw new NotFoundException('Worker engagement not found.');
    return {
      ...this.mapWorkforce(row),
      profileSnapshot: row.application.profileSnapshot,
      publicProfile: row.worker.workerProfile,
      taskNotes: row.taskNotes,
      terminationReason: row.terminationReason,
      payments: row.payments.map((p) => this.mapPayment(p, row)),
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
      include: { ...this.engagementInclude(), payments: true },
    });
    return {
      ...this.mapWorkforce(row),
      taskNotes: row.taskNotes,
      terminationReason: row.terminationReason,
      payments: row.payments.map((p) => this.mapPayment(p, row)),
    };
  }

  async paymentSummary(user: LocalAuthUser) {
    const payments = await this.prisma.payment.findMany({
      where: { payerId: user.id },
    });
    return {
      totalPayroll: payments.reduce((s, p) => s + Number(p.amount), 0),
      pending: payments
        .filter((p) => p.status === PaymentStatus.PENDING)
        .reduce((s, p) => s + Number(p.amount), 0),
      paidThisMonth: payments
        .filter((p) => p.status === PaymentStatus.COMPLETED)
        .reduce((s, p) => s + Number(p.amount), 0),
      outstanding: payments
        .filter((p) => p.status !== PaymentStatus.COMPLETED)
        .reduce((s, p) => s + Number(p.amount), 0),
      currency: 'XAF',
    };
  }

  async paymentWorkers(user: LocalAuthUser) {
    const rows = await this.prisma.workEngagement.findMany({
      where: { employerId: user.id },
      include: { ...this.engagementInclude(), payments: true },
    });
    return rows.map((e) => {
      const primary = e.worker.workerPaymentAccounts[0];
      return {
        engagementId: e.id,
        workerId: e.workerId,
        workerName:
          e.worker.workerProfile?.fullName ??
          e.worker.email ??
          e.worker.phone ??
          'Worker',
        jobTitle: e.job.title,
        amountDue: e.payRate,
        currency: e.payCurrency,
        provider: primary ? providerToApi(primary.provider) : null,
        recipientNumber: primary?.phoneNumber ?? '',
        paymentManagedByJoballa: e.job.paymentManagedByJoballa,
        alreadyPaid: e.payments.some(
          (p) => p.status === PaymentStatus.COMPLETED,
        ),
      };
    });
  }

  async payWorker(user: LocalAuthUser, body: Record<string, unknown>) {
    const engagement = await this.prisma.workEngagement.findFirst({
      where: {
        id: String(body.engagementId ?? ''),
        employerId: user.id,
        workerId: String(body.workerId ?? ''),
      },
    });
    if (!engagement) throw new NotFoundException('Engagement not found.');
    const provider = this.requiredEnum(MomoProvider, body.provider, 'provider');
    const payment = await this.prisma.payment.create({
      data: {
        engagementId: engagement.id,
        workerId: engagement.workerId,
        payerId: user.id,
        amount: Number(body.amount ?? engagement.payRate),
        mobileMoneyProvider: provider,
        recipientNumber: String(body.recipientNumber ?? ''),
        idempotencyKey: String(
          body.idempotencyKey ?? `${engagement.id}-${Date.now()}`,
        ),
        payPeriod: maybeString(body.payPeriod),
        status: PaymentStatus.PENDING,
      },
    });
    return {
      paymentId: payment.id,
      status: payment.status.toLowerCase(),
      message: 'Payment queued.',
    };
  }

  async paymentHistory(user: LocalAuthUser, query: Record<string, unknown>) {
    const { page, limit, skip } = pageParams(query.page, query.limit);
    const status = parseEnum(PaymentStatus, query.status);
    const where = { payerId: user.id, ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { initiatedAt: 'desc' },
        include: { engagement: { include: this.engagementInclude() } },
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

  async paymentDetail(user: LocalAuthUser, paymentId: string) {
    const p = await this.prisma.payment.findFirst({
      where: { id: paymentId, payerId: user.id },
      include: { engagement: { include: this.engagementInclude() } },
    });
    if (!p) throw new NotFoundException('Payment not found.');
    return {
      ...this.mapPayment(p, p.engagement),
      receiptNumber: p.receiptNumber,
      fapshiTransactionId: p.fapshiTransactionId,
      failureReason: p.failureReason,
    };
  }

  async company(user: LocalAuthUser) {
    const profile = await this.requireEmployer(user.id);
    const documents = await this.prisma.employerDocument.findMany({
      where: { employerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return this.mapCompany(profile.employerProfile!, documents);
  }

  async updateCompany(user: LocalAuthUser, body: Record<string, unknown>) {
    const paymentProvider = parseEnum(MomoProvider, body.paymentProvider);
    const profile = await this.prisma.employerProfile.update({
      where: { userId: user.id },
      data: {
        companyName: maybeString(body.companyName),
        companySize: maybeString(body.companySize),
        industry: maybeString(body.industry),
        country: maybeString(body.country),
        region: maybeString(body.region),
        city: maybeString(body.city),
        website: maybeString(body.website),
        description: maybeString(body.description),
        tagline: maybeString(body.tagline),
        contactPersonName: maybeString(body.contactPersonName),
        contactPersonTitle: maybeString(body.contactPersonTitle),
        contactEmail: maybeString(body.contactEmail),
        contactPhone: maybeString(body.contactPhone),
        paymentProvider,
        paymentAccount: maybeString(body.paymentAccount),
      },
    });
    const documents = await this.prisma.employerDocument.findMany({
      where: { employerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return this.mapCompany(profile, documents);
  }

  async uploadLogo(user: LocalAuthUser, url: string) {
    await this.prisma.employerProfile.update({
      where: { userId: user.id },
      data: { companyLogoUrl: url },
    });
    return this.company(user);
  }

  async createDocument(
    user: LocalAuthUser,
    file: Express.Multer.File,
    url: string,
    name?: string,
  ) {
    const row = await this.prisma.employerDocument.create({
      data: {
        employerId: user.id,
        documentName: name || file.originalname,
        documentUrl: url,
        documentType: fileTypeFromMime(file.mimetype),
        verificationStatus: VerificationStatus.PENDING,
      },
    });
    await this.prisma.employerProfile.update({
      where: { userId: user.id },
      data: { verificationStatus: VerificationStatus.PENDING },
    });
    return this.mapEmployerDocument(row);
  }

  async deleteDocument(user: LocalAuthUser, documentId: string) {
    await this.prisma.employerDocument.deleteMany({
      where: { id: documentId, employerId: user.id },
    });
    return { ok: true };
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
    const category = this.requiredEnum(
      DepartmentCategory,
      body.departmentCategory,
      'departmentCategory',
    );
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
    const data = notificationSettingsData(body);
    const row = await this.prisma.notificationSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
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

  private async requireEmployer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employerProfile: true },
    });
    if (!user || user.role !== Role.EMPLOYER) {
      throw new ForbiddenException('Employer account required.');
    }
    if (!user.employerProfile)
      throw new ForbiddenException('Employer profile missing.');
    return user;
  }

  private async findOwnedJob(ownerId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, ownerId },
      include: this.jobInclude(),
    });
    if (!job) throw new NotFoundException('Job not found.');
    return job;
  }

  private async findOwnedApplication(ownerId: string, applicationId: string) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, job: { ownerId } },
      include: this.applicationInclude(),
    });
    if (!app) throw new NotFoundException('Applicant not found.');
    return app;
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

  private jobInclude() {
    return {
      department: true,
      applications: true,
      _count: { select: { applications: true } },
    } as const;
  }

  private applicationInclude() {
    return {
      job: { include: this.jobInclude() },
      worker: {
        include: {
          workerProfile: true,
          workExperiences: { orderBy: { startDate: 'desc' as const } },
          educationItems: { orderBy: { startDate: 'desc' as const } },
          supportingDocuments: { orderBy: { createdAt: 'desc' as const } },
        },
      },
    } as const;
  }

  private engagementInclude() {
    return {
      job: true,
      worker: { include: { workerProfile: true, workerPaymentAccounts: true } },
      application: true,
    } as const;
  }

  private mapJobCard(job: any) {
    const submitted =
      job.applications?.filter(
        (a: any) => a.status === ApplicationStatus.SUBMITTED,
      ).length ?? 0;
    const shortlisted =
      job.applications?.filter(
        (a: any) => a.status === ApplicationStatus.SHORTLISTED,
      ).length ?? 0;
    const hired =
      job.applications?.filter((a: any) => a.status === ApplicationStatus.HIRED)
        .length ?? 0;
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
      submissionTier: null,
      rejectionReason: null,
      changeRequest: null,
      createdAt: job.createdAt.toISOString(),
      approvedAt: job.approvedAt?.toISOString() ?? null,
    };
  }

  private mapJobDetail(job: any) {
    return {
      ...this.mapJobCard(job),
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

  private mapWorkforce(e: any) {
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

  private mapPayment(p: any, engagement: any) {
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

  private mapCompany(profile: any, documents: any[]) {
    return {
      id: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
      companyLogoUrl: profile.companyLogoUrl,
      companySize: profile.companySize,
      industry: profile.industry,
      country: profile.country,
      region: profile.region,
      city: profile.city,
      website: profile.website,
      description: profile.description,
      tagline: profile.tagline,
      contactPersonName: profile.contactPersonName,
      contactPersonTitle: profile.contactPersonTitle,
      contactEmail: profile.contactEmail,
      contactPhone: profile.contactPhone,
      paymentProvider: profile.paymentProvider
        ? providerToApi(profile.paymentProvider)
        : null,
      paymentAccount: profile.paymentAccount,
      verificationStatus: verificationToApi(profile.verificationStatus),
      documents: documents.map((d) => this.mapEmployerDocument(d)),
    };
  }

  private mapEmployerDocument(document: any) {
    return {
      id: document.id,
      documentName: document.documentName,
      documentUrl: document.documentUrl,
      documentType: documentTypeToApi(
        document.documentType as DocumentFileType,
      ),
      verificationStatus: verificationToApi(document.verificationStatus),
      verificationNotes: document.verificationNotes,
      createdAt: document.createdAt.toISOString(),
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
    };
  }

  private mapNotification(n: any) {
    return {
      id: n.id,
      type: notificationTypeToApi(n.type),
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      relatedType: n.relatedType,
      relatedId: n.relatedId,
      createdAt: n.createdAt.toISOString(),
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
}

function maybeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function maybeStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.map(String) : undefined;
}

function notificationSettingsData(body: Record<string, unknown>) {
  const keys = [
    'inAppEnabled',
    'emailEnabled',
    'smsEnabled',
    'applicationUpdates',
    'jobUpdates',
    'paymentUpdates',
    'engagementUpdates',
    'securityAlerts',
    'marketingUpdates',
  ] as const;
  return Object.fromEntries(
    keys
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, Boolean(body[key])]),
  );
}
