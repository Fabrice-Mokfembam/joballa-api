import { VerificationStatus } from '@prisma/client';

export type ProfileCompletenessBreakdown = {
  personalInfo: number;
  summary: number;
  skills: number;
  experience: number;
  education: number;
  certifications: number;
  verification: number;
  languages: number;
};

export const MIN_PROFILE_COMPLETENESS_TO_APPLY = 60;

type CompletenessInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  city?: string | null;
  region?: string | null;
  professionalTitle?: string | null;
  shortBio?: string | null;
  skills?: string[];
  languages?: string[];
  verificationStatus?: VerificationStatus;
  workExperienceCount: number;
  educationCount: number;
  certificationCount: number;
};

export function computeWeightedProfileCompleteness(input: CompletenessInput): {
  profileCompleteness: number;
  profileStrengthBreakdown: ProfileCompletenessBreakdown;
} {
  const personalFields = [
    input.fullName?.trim(),
    input.photoUrl?.trim(),
    input.email?.trim() || input.phone?.trim(),
    input.phone?.trim() || input.email?.trim(),
    input.city?.trim() && input.region?.trim(),
  ];
  const personalFilled = personalFields.filter(Boolean).length;
  const personalInfo = Math.round((personalFilled / 5) * 20);

  const hasTitle = Boolean(input.professionalTitle?.trim());
  const hasBio = Boolean(input.shortBio?.trim());
  const summary = (hasTitle ? 5 : 0) + (hasBio ? 5 : 0);

  const skillCount = input.skills?.length ?? 0;
  const skills =
    skillCount === 0 ? 0 : skillCount >= 3 ? 15 : Math.min(15, skillCount * 5);

  const experience = input.workExperienceCount > 0 ? 20 : 0;
  const education = input.educationCount > 0 ? 10 : 0;
  const certifications = input.certificationCount > 0 ? 10 : 0;
  const verification =
    input.verificationStatus === VerificationStatus.VERIFIED ? 10 : 0;
  const languages = (input.languages?.length ?? 0) > 0 ? 5 : 0;

  const profileStrengthBreakdown: ProfileCompletenessBreakdown = {
    personalInfo,
    summary,
    skills,
    experience,
    education,
    certifications,
    verification,
    languages,
  };

  const profileCompleteness = Object.values(profileStrengthBreakdown).reduce(
    (sum, n) => sum + n,
    0,
  );

  return { profileCompleteness, profileStrengthBreakdown };
}
