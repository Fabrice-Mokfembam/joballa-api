export type SnapshotWorkerView = {
  workerId: string;
  name: string;
  title: string;
  avatar: string | null;
  verified: boolean;
  topSkills: string[];
  location: string;
  phone?: string;
  languages?: string[];
  professionalSummary?: string;
  industries?: string[];
  preferredJobTypes?: string[];
  skills?: string[];
  workHistory?: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function workerViewFromSnapshot(
  workerId: string,
  snapshot: unknown,
  fallback?: { fullName: string; city?: string | null; skills?: string[] },
): SnapshotWorkerView {
  const snap = asRecord(snapshot);
  const fullName =
    (typeof snap?.fullName === 'string' && snap.fullName) ||
    fallback?.fullName ||
    'Worker';
  const skills = Array.isArray(snap?.skills)
    ? (snap.skills as string[])
    : (fallback?.skills ?? []);
  const city =
    (typeof snap?.city === 'string' && snap.city) || fallback?.city || '';

  return {
    workerId,
    name: fullName,
    title:
      (typeof snap?.title === 'string' && snap.title) ||
      (typeof snap?.bio === 'string' ? snap.bio.slice(0, 80) : '') ||
      'Worker',
    avatar: typeof snap?.avatar === 'string' ? snap.avatar : null,
    verified:
      snap?.verificationStatus === 'VERIFIED' ||
      snap?.verified === true ||
      false,
    topSkills: skills.slice(0, 5),
    location: city || 'Cameroon',
    phone: typeof snap?.phone === 'string' ? snap.phone : undefined,
    languages: Array.isArray(snap?.languagesSpoken)
      ? (snap.languagesSpoken as string[])
      : undefined,
    professionalSummary: typeof snap?.bio === 'string' ? snap.bio : undefined,
    industries: Array.isArray(snap?.preferredJobCategories)
      ? (snap.preferredJobCategories as string[])
      : undefined,
    preferredJobTypes: Array.isArray(snap?.preferredJobTypes)
      ? (snap.preferredJobTypes as string[])
      : undefined,
    skills,
    workHistory: Array.isArray(snap?.workHistory)
      ? (snap.workHistory as unknown[])
      : undefined,
  };
}

export function submittedProfileFromSnapshot(
  workerId: string,
  snapshot: unknown,
  worker?: { fullName: string; city?: string | null; skills?: string[] },
): SnapshotWorkerView {
  return workerViewFromSnapshot(workerId, snapshot, worker);
}
