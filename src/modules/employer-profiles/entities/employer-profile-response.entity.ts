import type {
  EmployerProfile,
  MomoProvider,
  VerificationStatus,
} from '@prisma/client';

export interface EmployerProfileResponseEntity {
  id: string;
  userId: string;
  companyName: string;
  industry: string | null;
  companySize: string | null;
  location: string | null;
  logoUrl: string | null;
  website: string | null;
  about: string | null;
  isJoballaDepartment: boolean;
  departmentCategory: string | null;
  businessRegDocUrl: string | null;
  verificationStatus: VerificationStatus;
  verificationNotes: string | null;
  paymentProvider: MomoProvider | null;
  paymentAccount: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toEmployerProfileResponseEntity(
  profile: EmployerProfile,
): EmployerProfileResponseEntity {
  return {
    id: profile.id,
    userId: profile.userId,
    companyName: profile.companyName,
    industry: profile.industry,
    companySize: profile.companySize,
    location: profile.location,
    logoUrl: profile.logoUrl,
    website: profile.website,
    about: profile.about,
    isJoballaDepartment: profile.isJoballaDepartment,
    departmentCategory: profile.departmentCategory,
    businessRegDocUrl: profile.businessRegDocUrl,
    verificationStatus: profile.verificationStatus,
    verificationNotes: profile.verificationNotes,
    paymentProvider: profile.paymentProvider,
    paymentAccount: profile.paymentAccount,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
