import type {
  AccountStatus,
  PreferredLanguage,
  Role,
  User,
} from '@prisma/client';

export type LocalAuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: Role;
  preferredLanguage: PreferredLanguage;
  accountStatus: AccountStatus;
  profilePhotoUrl: string | null;
  workerProfileId?: string | null;
  employerProfileId?: string | null;
};

type UserWithProfiles = User & {
  workerProfile?: { id: string } | null;
  employerProfile?: { id: string } | null;
};

export function mapUserToLocalAuthUser(user: UserWithProfiles): LocalAuthUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    accountStatus: user.accountStatus,
    profilePhotoUrl: user.photoUrl,
    workerProfileId: user.workerProfile?.id ?? null,
    employerProfileId: user.employerProfile?.id ?? null,
  };
}
