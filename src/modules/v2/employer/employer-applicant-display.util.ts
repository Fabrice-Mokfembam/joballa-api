type WorkerProfileSlice = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  professionalTitle?: string | null;
  shortBio?: string | null;
  city?: string | null;
  region?: string | null;
  skills?: string[];
} | null;

export type ApplicantDisplaySource = {
  profileSnapshot: unknown;
  worker?: {
    email?: string | null;
    phone?: string | null;
    workerProfile?: WorkerProfileSlice & {
      preferredJobCategories?: string[];
      preferredJobTypes?: string[];
      languages?: string[];
      country?: string | null;
      verificationStatus?: string;
    };
  } | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function composedName(
  first: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const parts = [first, last]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/** True when the string looks like an email — never use as card display name. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Display name for applicant cards — prefers immutable application snapshot.
 */
export function resolveWorkerDisplayName(
  source: ApplicantDisplaySource,
): string {
  const snap = asRecord(source.profileSnapshot);
  const profile = source.worker?.workerProfile ?? null;

  const candidates = [
    nonEmptyString(snap?.fullName),
    nonEmptyString(profile?.fullName),
    composedName(
      nonEmptyString(snap?.firstName) ?? profile?.firstName,
      nonEmptyString(snap?.lastName) ?? profile?.lastName,
    ),
    nonEmptyString(source.worker?.phone),
    'Worker',
  ];

  for (const name of candidates) {
    if (name && !looksLikeEmail(name)) return name;
  }
  return 'Worker';
}

/**
 * Professional subtitle under the name on applicant cards.
 */
export function resolveWorkerHeadline(
  source: ApplicantDisplaySource,
): string | null {
  const snap = asRecord(source.profileSnapshot);
  const profile = source.worker?.workerProfile ?? null;
  const summary =
    nonEmptyString(snap?.summary) ??
    nonEmptyString(snap?.bio) ??
    nonEmptyString(snap?.shortBio) ??
    nonEmptyString(profile?.shortBio);

  const title =
    nonEmptyString(snap?.professionalTitle) ??
    nonEmptyString(profile?.professionalTitle);

  const legacyHeadline = nonEmptyString(snap?.headline);
  if (title) return title;
  if (legacyHeadline && legacyHeadline !== summary) return legacyHeadline;
  return null;
}

export function resolveWorkerEmail(
  source: ApplicantDisplaySource,
): string | null {
  return nonEmptyString(source.worker?.email);
}

export function resolveApplicantTopSkills(
  source: ApplicantDisplaySource,
  limit = 5,
): string[] {
  const snap = asRecord(source.profileSnapshot);
  const fromSnap = Array.isArray(snap?.skills)
    ? (snap.skills as unknown[]).filter(
        (s): s is string => typeof s === 'string',
      )
    : [];
  const fromProfile = source.worker?.workerProfile?.skills ?? [];
  const merged = fromSnap.length ? fromSnap : fromProfile;
  return merged.slice(0, limit);
}

export function resolveWorkerLocation(
  source: ApplicantDisplaySource,
): string | null {
  const snap = asRecord(source.profileSnapshot);
  const profile = source.worker?.workerProfile ?? null;
  const city = nonEmptyString(snap?.city) ?? profile?.city ?? null;
  const region = nonEmptyString(snap?.region) ?? profile?.region ?? null;
  const joined = [city, region].filter(Boolean).join(', ');
  return joined || null;
}
