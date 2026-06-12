export type AuthSessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: 'worker' | 'employer';
  preferredLanguage: 'eng' | 'fre';
  accountStatus: 'active' | 'suspended' | 'deactivated';
  profilePhotoUrl?: string | null;
  workerProfileId?: string | null;
  employerProfileId?: string | null;
};

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthSessionUser;
};

export type AuthMeResponse = {
  user: AuthSessionUser;
};

export function getDashboardRouteForRole(role: 'worker' | 'employer'): string {
  return role === 'worker' ? '/worker/jobs' : '/employer';
}
