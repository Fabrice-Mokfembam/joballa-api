export const WORKER_PROFILE_SELECT = {
  id: true,
  userId: true,
  fullName: true,
  firstName: true,
  lastName: true,
  city: true,
  region: true,
  country: true,
  professionalTitle: true,
  bio: true,
  industries: true,
  preferredJobCategories: true,
  preferredJobTypes: true,
  availabilityStatus: true,
  skills: true,
  languagesSpoken: true,
  profileCompleteness: true,
  mobileMoneyProvider: true,
  mobileMoneyNumber: true,
  bankName: true,
  bankAccountNumber: true,
  nationalIdDocUrl: true,
  verificationStatus: true,
  uploadedResumeUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Profile completeness weights — must sum to 100.
 * Used by computeProfileCompleteness() in workers.service.ts.
 */
export const PROFILE_COMPLETENESS_WEIGHTS = {
  fullName: 10,
  professionalTitle: 10,
  bio: 10,
  skills: 15,
  workHistory: 15,
  education: 10,
  languagesSpoken: 5,
  avatar: 5,
  paymentDetails: 10,
  kyc: 10,
} as const;

export const MIN_COMPLETENESS_TO_APPLY = 60;
