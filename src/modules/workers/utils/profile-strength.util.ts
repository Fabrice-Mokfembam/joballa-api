import type { WorkerProfile } from '@prisma/client';

export interface ProfileStrengthBreakdown {
  personalInfo: boolean;
  kyc: boolean;
  professionalSummary: boolean;
  skills: boolean;
  workHistory: boolean;
  educationAndCertifications: boolean;
  verification: boolean;
  paymentDetails: boolean;
}

export function computeProfileStrengthBreakdown(profile: {
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  professionalTitle: string | null;
  bio: string | null;
  skills: string[];
  avatarUrl: string | null;
  nationalIdDocUrl: string | null;
  mobileMoneyNumber: string | null;
  bankAccountNumber: string | null;
  workHistories?: unknown[];
  educations?: unknown[];
  certifications?: unknown[];
  kycSubmissions?: { status: string }[];
}): ProfileStrengthBreakdown {
  const personalInfo = Boolean(
    profile.fullName?.trim() &&
    (profile.city?.trim() || profile.firstName?.trim()),
  );
  const kycVerified =
    profile.kycSubmissions?.some((k) => k.status === 'VERIFIED') ?? false;
  const kycSubmitted = (profile.kycSubmissions?.length ?? 0) > 0;
  const hasEducation =
    (profile.educations?.length ?? 0) > 0 ||
    (profile.certifications?.length ?? 0) > 0;

  return {
    personalInfo,
    kyc: kycVerified,
    professionalSummary: Boolean(
      profile.professionalTitle?.trim() && profile.bio?.trim(),
    ),
    skills: profile.skills.length > 0,
    workHistory: (profile.workHistories?.length ?? 0) > 0,
    educationAndCertifications: hasEducation,
    verification: kycSubmitted,
    paymentDetails: Boolean(
      profile.mobileMoneyNumber?.trim() || profile.bankAccountNumber?.trim(),
    ),
  };
}
