import type {
  AvailabilityStatus,
  MomoProvider,
  VerificationStatus,
  WorkerProfile,
} from '@prisma/client';

export interface WorkerProfileResponseEntity {
  id: string;
  userId: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  professionalTitle: string | null;
  bio: string | null;
  skills: string[];
  industries: string[];
  preferredJobCategories: string[];
  languagesSpoken: string[];
  availabilityStatus: AvailabilityStatus;
  profileCompleteness: number;
  verificationStatus: VerificationStatus;
  mobileMoneyProvider: MomoProvider | null;
  mobileMoneyNumber: string | null;
  uploadedResumeUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function toWorkerProfileResponseEntity(
  profile: WorkerProfile,
): WorkerProfileResponseEntity {
  return {
    id: profile.id,
    userId: profile.userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: profile.fullName,
    bio: profile.bio,
    industries: profile.industries,
    city: profile.city,
    region: profile.region,
    country: profile.country,
    professionalTitle: profile.professionalTitle,
    preferredJobCategories: profile.preferredJobCategories,
    languagesSpoken: profile.languagesSpoken,
    availabilityStatus: profile.availabilityStatus,
    skills: profile.skills,
    verificationStatus: profile.verificationStatus,
    uploadedResumeUrl: profile.uploadedResumeUrl,
    profileCompleteness: profile.profileCompleteness,
    mobileMoneyProvider: profile.mobileMoneyProvider,
    mobileMoneyNumber: profile.mobileMoneyNumber,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
