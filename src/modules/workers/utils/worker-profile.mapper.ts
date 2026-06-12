import type {
  Certification,
  Education,
  KYCSubmission,
  WorkerDocument,
  WorkerPaymentAccount,
  WorkHistory,
} from '@prisma/client';
import { computeProfileStrengthBreakdown } from './profile-strength.util';

type FullProfileRow = {
  id: string;
  userId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  dateOfBirth: Date | null;
  languagesSpoken: string[];
  availabilityStatus: string;
  professionalTitle: string | null;
  bio: string | null;
  industries: string[];
  preferredJobCategories: string[];
  preferredJobTypes: string[];
  skills: string[];
  verificationStatus: string;
  profileCompleteness: number;
  profileStrengthBreakdown: unknown;
  profileViews: number;
  mobileMoneyProvider: string | null;
  mobileMoneyNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  workHistories: WorkHistory[];
  educations: Education[];
  certifications: Certification[];
  documents: WorkerDocument[];
  kycSubmissions: KYCSubmission[];
  paymentAccounts?: WorkerPaymentAccount[];
  user: { email: string | null; phone: string | null };
};

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function mapWorkHistory(row: WorkHistory) {
  return {
    id: row.id,
    company: row.company,
    companyName: row.company,
    role: row.role,
    jobTitle: row.role,
    location: row.location,
    city: row.city,
    region: row.region,
    website: row.website,
    description: row.description,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    startMonth: row.startMonth,
    startYear: row.startYear,
    endMonth: row.endMonth,
    endYear: row.endYear,
    isCurrent: row.isCurrent,
  };
}

function mapEducation(row: Education) {
  return {
    id: row.id,
    school: row.school,
    institution: row.school,
    degree: row.degree,
    fieldOfStudy: row.fieldOfStudy,
    website: row.website,
    city: row.city,
    region: row.region,
    description: row.description,
    startDate: isoDate(row.startDate),
    endDate: isoDate(row.endDate),
    startMonth: row.startMonth,
    startYear: row.startYear,
    endMonth: row.endMonth,
    endYear: row.endYear,
    isCurrent: row.isCurrent,
  };
}

function mapDocument(row: WorkerDocument) {
  return {
    id: row.id,
    type: row.type,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    url: row.fileUrl,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    uploadedAt: row.uploadedAt.toISOString(),
    reviewStatus: row.reviewStatus,
  };
}

function mapKyc(row: KYCSubmission) {
  return {
    id: row.id,
    documentType: row.documentType,
    status: row.status,
    frontIdImageUrl: row.frontImageUrl,
    backIdImageUrl: row.backImageUrl,
    selfieImageUrl: row.selfieImageUrl,
    rejectionReason: row.rejectionReason,
    reviewNotes: row.reviewNotes,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export function mapWorkerFullProfile(
  profile: FullProfileRow,
  options?: { includePayment?: boolean },
) {
  const includePayment = options?.includePayment !== false;
  const breakdown =
    (profile.profileStrengthBreakdown as Record<string, boolean> | null) ??
    computeProfileStrengthBreakdown({
      ...profile,
      nationalIdDocUrl: profile.avatarUrl,
      workHistories: profile.workHistories,
      educations: profile.educations,
      certifications: profile.certifications,
      kycSubmissions: profile.kycSubmissions,
    });

  const paymentAccounts =
    profile.paymentAccounts?.map((a) => ({
      id: a.id,
      provider: a.provider,
      phone: a.phone,
      isPrimary: a.isPrimary,
    })) ?? [];

  const base = {
    id: profile.id,
    userId: profile.userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    city: profile.city,
    region: profile.region,
    country: profile.country,
    phone: profile.user.phone,
    email: profile.user.email,
    languages: profile.languagesSpoken,
    languagesSpoken: profile.languagesSpoken,
    availabilityStatus: profile.availabilityStatus,
    professionalTitle: profile.professionalTitle,
    summary: profile.bio,
    bio: profile.bio,
    industries: profile.industries,
    preferredJobCategories: profile.preferredJobCategories,
    preferredJobTypes: profile.preferredJobTypes,
    skills: profile.skills,
    verificationStatus: profile.verificationStatus,
    profileCompleteness: profile.profileCompleteness,
    profileStrengthBreakdown: breakdown,
    profileViews: profile.profileViews,
    workHistories: profile.workHistories.map(mapWorkHistory),
    educations: profile.educations.map(mapEducation),
    certifications: profile.certifications.map((c) => ({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      description: c.description,
      credentialUrl: c.credentialUrl,
      documentId: c.documentId,
      issueDate: isoDate(c.issueDate),
      expiryDate: isoDate(c.expiryDate),
      fileUrl: c.fileUrl,
    })),
    documents: profile.documents.map(mapDocument),
    kycSubmissions: profile.kycSubmissions.map(mapKyc),
  };

  if (!includePayment) {
    return base;
  }

  return {
    ...base,
    mobileMoneyProvider: profile.mobileMoneyProvider,
    mobileMoneyNumber: profile.mobileMoneyNumber,
    bankName: profile.bankName,
    accountNumber: profile.bankAccountNumber,
    paymentAccounts,
  };
}

export function mapWorkerMe(user: {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  languagePreference: string;
  verificationStatus: string;
  workerProfile: FullProfileRow | null;
}) {
  if (!user.workerProfile) {
    return user;
  }

  const wp = user.workerProfile;
  const breakdown =
    (wp.profileStrengthBreakdown as Record<string, boolean> | null) ??
    computeProfileStrengthBreakdown({
      ...wp,
      nationalIdDocUrl: wp.avatarUrl,
      workHistories: [],
      educations: [],
      certifications: [],
      kycSubmissions: [],
    });

  return {
    ...user,
    workerProfile: {
      id: wp.id,
      fullName: wp.fullName,
      firstName: wp.firstName,
      lastName: wp.lastName,
      city: wp.city,
      region: wp.region,
      professionalTitle: wp.professionalTitle,
      avatarUrl: wp.avatarUrl,
      profileCompleteness: wp.profileCompleteness,
      profileStrengthBreakdown: breakdown,
      profileViews: wp.profileViews,
      availabilityStatus: wp.availabilityStatus,
      verificationStatus: wp.verificationStatus,
    },
  };
}
