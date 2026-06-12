import type { Language, Role, User, VerificationStatus } from '@prisma/client';

export interface UserSummaryEntity {
  id: string;
  email: string | null;
  phone: string | null;
  role: Role;
  languagePreference: Language;
  verificationStatus: VerificationStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toUserSummaryEntity(user: User): UserSummaryEntity {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    languagePreference: user.languagePreference,
    verificationStatus: user.verificationStatus,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
