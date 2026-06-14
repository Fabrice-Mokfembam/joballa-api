import {
  Role,
  VerificationStatus,
  type AdminAccount,
  type Department,
  type Dispute,
  type EmployerDocument,
  type Job,
  type KycSubmission,
  JobPostedByType,
  type Payment,
  type User,
} from '@prisma/client';
import {
  disputeStatusToApi,
  documentStatusToAdminApi,
  isVerifiedUser,
  jobStatusToAdminApi,
  kycStatusToAdminApi,
  adminRoleToApi,
} from './admin-api-format';
import {
  employmentTypeToApi,
  jobPostedByTypeToApi,
  providerToApi,
  roleToApi,
  workModeToApi,
} from '../shared/api-format';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function mapSessionDepartments(
  links: Array<{ department: { id: string; name: string } }>,
) {
  return links.map((l) => ({ id: l.department.id, name: l.department.name }));
}

export function mapKycRow(
  row: KycSubmission & {
    worker: User & {
      workerProfile: {
        fullName: string | null;
        city: string | null;
        region: string | null;
        verificationStatus: VerificationStatus;
      } | null;
    };
  },
) {
  return {
    id: row.id,
    status: kycStatusToAdminApi(row.status),
    kycType: row.kycType.toLowerCase(),
    frontUrl: row.frontUrl,
    backUrl: row.backUrl,
    selfieUrl: row.selfieUrl,
    submittedAt: row.createdAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    verifiedBy: row.verifiedByAdminId,
    rejectionReason: row.rejectionReason,
    worker: {
      id: row.worker.id,
      email: row.worker.email,
      phone: row.worker.phone,
      fullName: row.worker.workerProfile?.fullName ?? '',
      photoUrl: row.worker.photoUrl,
      city: row.worker.workerProfile?.city,
      region: row.worker.workerProfile?.region,
      isVerified:
        row.worker.workerProfile?.verificationStatus ===
        VerificationStatus.VERIFIED,
    },
  };
}

export function mapDocumentRow(
  row: EmployerDocument & {
    employer: User & {
      role: Role;
      workerProfile: { fullName: string | null } | null;
      employerProfile: { companyName: string } | null;
    };
    reviewer?: { id: string; fullName: string; email: string } | null;
  },
) {
  const submitterName =
    row.employer.role === Role.WORKER
      ? (row.employer.workerProfile?.fullName ?? '')
      : (row.employer.employerProfile?.companyName ?? '');
  return {
    id: row.id,
    documentName: row.documentName,
    documentUrl: row.documentUrl,
    documentType: row.documentType.toLowerCase(),
    verificationStatus: documentStatusToAdminApi(row.verificationStatus),
    verificationNotes: row.verificationNotes,
    rejectionReason:
      row.verificationStatus === VerificationStatus.REJECTED
        ? row.verificationNotes
        : null,
    submittedAt: row.createdAt.toISOString(),
    reviewer: row.reviewer
      ? {
          id: row.reviewer.id,
          name: row.reviewer.fullName,
          email: row.reviewer.email,
        }
      : null,
    submitter: {
      id: row.employer.id,
      email: row.employer.email,
      phone: row.employer.phone,
      role: roleToApi(row.employer.role),
      fullName: submitterName,
      photoUrl: row.employer.photoUrl,
    },
  };
}

export function mapJobRow(
  job: Job & {
    department: { id: string; name: string; slug: string } | null;
    owner: User & {
      photoUrl: string | null;
      workerProfile: { fullName: string | null } | null;
      employerProfile: {
        id: string;
        companyName: string;
        companyLogoUrl: string | null;
        city: string | null;
        country: string | null;
      } | null;
    };
    _count?: { applications: number };
  },
  extras?: {
    rejectionReason?: {
      id: string;
      reasonText: string;
      rejectedByAdminId: string | null;
      createdAt: Date;
    } | null;
    submissionScore?: {
      score: number;
      tier: string;
      scoreBreakdown: unknown;
    } | null;
  },
) {
  const isWorkerPoster = job.postedByType === JobPostedByType.WORKER;
  const posterName = isWorkerPoster
    ? (job.owner.workerProfile?.fullName ?? 'Unknown')
    : (job.owner.employerProfile?.companyName ?? 'Unknown');
  const posterPhotoUrl = isWorkerPoster
    ? job.owner.photoUrl
    : (job.owner.employerProfile?.companyLogoUrl ?? job.owner.photoUrl);

  return {
    id: job.id,
    title: job.title,
    status: jobStatusToAdminApi(job.status),
    postedByType: jobPostedByTypeToApi(job.postedByType),
    employmentType: employmentTypeToApi(job.employmentType),
    jobType: workModeToApi(job.workMode),
    country: job.country,
    city: job.city,
    neighbourhood: job.neighbourhood,
    payAmount: job.payAmount,
    experienceLevel: job.experienceLevel?.toLowerCase() ?? null,
    startDate: job.startDate?.toISOString() ?? null,
    startNow: job.startNow,
    duration: job.duration,
    description: job.description,
    requirements: job.requirements,
    responsibilities: job.responsibilities,
    requiredSkills: job.requiredSkills,
    adminNotes: job.adminNotes,
    approvedById: job.approvedByAdminId,
    approvedAt: job.approvedAt?.toISOString() ?? null,
    paymentManagedByJoballa: job.paymentManagedByJoballa,
    departmentId: job.departmentId,
    department: job.department
      ? {
          id: job.department.id,
          name: job.department.name,
          slug: job.department.slug,
        }
      : null,
    employer: {
      id: job.owner.employerProfile?.id ?? job.ownerId,
      userId: job.ownerId,
      companyName: posterName,
      companyLogoUrl: posterPhotoUrl,
      photoUrl: job.owner.photoUrl,
      city: job.owner.employerProfile?.city ?? job.city,
      country: job.owner.employerProfile?.country ?? job.country,
    },
    rejectionReason: extras?.rejectionReason
      ? {
          id: extras.rejectionReason.id,
          reasonText: extras.rejectionReason.reasonText,
          rejectedBy: extras.rejectionReason.rejectedByAdminId,
          createdAt: extras.rejectionReason.createdAt.toISOString(),
        }
      : null,
    submissionScore: extras?.submissionScore ?? null,
    applicationsCount: job._count?.applications ?? 0,
    createdByAdmin: job.createdByAdminId != null,
    createdByAdminId: job.createdByAdminId,
    createdAt: job.createdAt.toISOString(),
  };
}

export function mapDepartmentRow(
  dept: Department & { _count?: { jobs: number } },
  metrics?: {
    applicationsCount?: number;
    hiresCount?: number;
  },
) {
  const jobs = dept._count?.jobs ?? 0;
  const applications = metrics?.applicationsCount ?? 0;
  const hires = metrics?.hiresCount ?? 0;
  return {
    id: dept.id,
    name: dept.name,
    description: dept.description,
    jobPostsCount: jobs,
    jobs,
    applicationsCount: applications,
    applications,
    hiresCount: hires,
    hires,
    createdBy: dept.createdByAdminId,
    createdAt: dept.createdAt.toISOString(),
  };
}

export function mapPlatformUser(
  user: User & {
    workerProfile: {
      fullName: string | null;
      verificationStatus: VerificationStatus;
    } | null;
    employerProfile: {
      companyName: string;
      verificationStatus: VerificationStatus;
    } | null;
  },
) {
  const role = roleToApi(user.role);
  const verified = isVerifiedUser(
    role,
    user.workerProfile?.verificationStatus,
    user.employerProfile?.verificationStatus,
  );
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role,
    isVerified: verified,
    isActive: user.accountStatus === 'ACTIVE',
    country: user.country,
    city: user.city,
    region: user.region,
    photoUrl: user.photoUrl,
    preferredLanguage: user.preferredLanguage === 'FRE' ? 'FRE' : 'ENG',
    createdByAdmin: user.createdByAdminId,
    createdAt: user.createdAt.toISOString(),
    profile:
      user.role === Role.WORKER ? user.workerProfile : user.employerProfile,
  };
}

function mapDisputeParty(
  user: User & {
    role: Role;
    workerProfile: { fullName: string | null } | null;
    employerProfile: { companyName: string } | null;
  },
) {
  const role = roleToApi(user.role);
  const fullName =
    user.role === Role.WORKER
      ? (user.workerProfile?.fullName ?? user.email ?? '')
      : (user.employerProfile?.companyName ?? user.email ?? '');
  return {
    userId: user.id,
    fullName,
    email: user.email,
    phone: user.phone,
    role,
  };
}

export function mapDisputeRow(
  row: Dispute & {
    raisedBy: User & {
      role: Role;
      workerProfile: { fullName: string | null } | null;
      employerProfile: { companyName: string } | null;
    };
    against: User & {
      role: Role;
      workerProfile: { fullName: string | null } | null;
      employerProfile: { companyName: string } | null;
    };
    engagement?: {
      id: string;
      payRate: number;
      payStructure: string;
      job: { title: string };
    } | null;
  },
) {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    status: disputeStatusToApi(row.status),
    priority: row.priority.toLowerCase(),
    adminNotes: row.adminNotes,
    resolvedBy: row.resolvedByAdminId,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    engagementId: row.engagementId,
    engagement: row.engagement
      ? {
          id: row.engagement.id,
          jobTitle: row.engagement.job.title,
          payRate: row.engagement.payRate,
          payPeriod: row.engagement.payStructure.toLowerCase(),
        }
      : null,
    reporter: mapDisputeParty(row.raisedBy),
    reported: mapDisputeParty(row.against),
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapAdminRow(
  admin: AdminAccount & {
    permissions: { permission: string }[];
    departmentLinks: Array<{ department: { id: string; name: string } }>;
  },
) {
  let status: 'active' | 'pending' | 'inactive' = 'active';
  if (admin.invitePending) status = 'pending';
  else if (!admin.isActive) status = 'inactive';

  return {
    id: admin.id,
    name: admin.fullName,
    email: admin.email,
    role: adminRoleToApi(admin.role),
    isActive: admin.isActive,
    status,
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    createdBy: admin.createdByAdminId,
    createdAt: admin.createdAt.toISOString(),
    departments: admin.departmentLinks.map((d) => d.department),
    permissions: admin.permissions.map((p) => p.permission),
  };
}

export function mapPaymentRecord(
  payment: Payment & {
    worker: User & { workerProfile: { fullName: string | null } | null };
    payer: User & { employerProfile: { companyName: string } | null };
    engagement: { job: { title: string } };
  },
) {
  return {
    id: payment.id,
    fapshiTransactionId: payment.fapshiTransactionId,
    amount: Number(payment.amount),
    currency: payment.currency,
    type: 'payout',
    mode: 'salary_payment',
    provider: providerToApi(payment.mobileMoneyProvider),
    status: payment.status.toUpperCase(),
    from: {
      id: payment.payerId,
      name: payment.payer.employerProfile?.companyName ?? 'Employer',
      email: payment.payer.email,
      type: 'employer',
    },
    to: {
      id: payment.workerId,
      name: payment.worker.workerProfile?.fullName ?? 'Worker',
      email: payment.worker.email,
      type: 'worker',
    },
    engagementId: payment.engagementId,
    payPeriod: payment.payPeriod,
    receiptNumber: payment.receiptNumber,
    failureReason: payment.failureReason,
    initiatedAt: payment.initiatedAt.toISOString(),
    completedAt: payment.completedAt?.toISOString() ?? null,
  };
}

export function isReservedOtherDepartmentName(name: string): boolean {
  return name.trim().toLowerCase() === 'other';
}

export function profileScopeWhere(ctx: { isSuperAdmin: boolean; id: string }) {
  if (ctx.isSuperAdmin) return { createdByAdminId: { not: null } };
  return { createdByAdminId: ctx.id };
}
