import type { EmployerProfile, User } from '@prisma/client';

export interface EmployerMeEntity {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  languagePreference: string;
  company: {
    id: string;
    name: string;
    logo: string | null;
  };
  roles: 'employer';
}

function splitNameFromUser(
  user: User,
  companyName: string,
): {
  firstName: string;
  lastName: string;
} {
  if (user.email) {
    const local = user.email.split('@')[0] ?? '';
    const parts = local.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
  }
  const words = companyName.trim().split(/\s+/);
  if (words.length >= 2) {
    return { firstName: words[0], lastName: words.slice(1).join(' ') };
  }
  return { firstName: companyName || 'Employer', lastName: '' };
}

export function toEmployerMeEntity(
  user: User,
  profile: EmployerProfile,
): EmployerMeEntity {
  const { firstName, lastName } = splitNameFromUser(user, profile.companyName);
  return {
    id: user.id,
    firstName,
    lastName,
    email: user.email,
    phone: user.phone,
    avatar: profile.logoUrl,
    languagePreference: user.languagePreference,
    company: {
      id: profile.id,
      name: profile.companyName,
      logo: profile.logoUrl,
    },
    roles: 'employer',
  };
}
