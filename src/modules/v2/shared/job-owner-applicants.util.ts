import {
  resolveApplicantTopSkills,
  resolveWorkerDisplayName,
  resolveWorkerEmail,
  resolveWorkerHeadline,
  resolveWorkerLocation,
} from '../employer/employer-applicant-display.util';
import {
  normalizeApplicantProfileSnapshot,
  normalizeAttachedDocuments,
  mergeApplicantDocuments,
  type ApplicantProfileSnapshot,
} from '../employer/employer-applicant-snapshot.util';
import { applicationStatusToApi, verificationToApi } from './api-format';
import {
  enrichApplicantDocuments,
  type DocumentUrlContext,
} from './document-url.util';

export const JOB_OWNER_APPLICATION_INCLUDE = {
  job: {
    include: {
      department: true,
      applications: true,
      _count: { select: { applications: true } },
    },
  },
  worker: {
    include: {
      workerProfile: true,
      workExperiences: { orderBy: { startDate: 'desc' as const } },
      educationItems: { orderBy: { startDate: 'desc' as const } },
      certifications: { orderBy: { issueDate: 'desc' as const } },
      supportingDocuments: { orderBy: { createdAt: 'desc' as const } },
    },
  },
} as const;

function snapshotContext(
  app: any,
  documentScope: DocumentUrlContext['scope'],
): DocumentUrlContext {
  return { scope: documentScope, applicationId: app.id };
}

function buildSnapshot(
  app: any,
  snapshotOnly: boolean,
): ApplicantProfileSnapshot {
  return normalizeApplicantProfileSnapshot(app.profileSnapshot, {
    jobRequiredSkills: app.job?.requiredSkills ?? [],
    worker: snapshotOnly ? null : app.worker,
    snapshotOnly,
  });
}

function enrichDocuments(
  app: any,
  snapshot: ApplicantProfileSnapshot,
  documentScope: DocumentUrlContext['scope'],
) {
  const attached = normalizeAttachedDocuments(app.attachedDocuments);
  const merged = mergeApplicantDocuments(snapshot, attached);
  return enrichApplicantDocuments(merged, snapshotContext(app, documentScope));
}

export function mapJobOwnerApplicantListItem(
  app: any,
  _documentScope: DocumentUrlContext['scope'],
) {
  const profileSnapshot = buildSnapshot(app, true);
  const source = { profileSnapshot, worker: app.worker };
  const highlighted = profileSnapshot.highlightedSkills ?? [];
  const topSkills =
    highlighted.length > 0
      ? highlighted.slice(0, 5)
      : profileSnapshot.skills.slice(0, 5);

  return {
    id: app.id,
    applicationId: app.id,
    jobId: app.jobId,
    jobTitle: app.job.title,
    workerId: app.workerId,
    workerName: resolveWorkerDisplayName(source),
    workerHeadline:
      resolveWorkerHeadline(source) ??
      profileSnapshot.headline ??
      profileSnapshot.professionalTitle ??
      null,
    workerEmail: resolveWorkerEmail(source),
    workerPhotoUrl: profileSnapshot.avatarUrl ?? null,
    workerLocation: profileSnapshot.location ?? resolveWorkerLocation(source),
    topSkills: topSkills.length ? topSkills : resolveApplicantTopSkills(source),
    verificationStatus: profileSnapshot.verificationStatus ?? 'not_submitted',
    availabilityStatus: profileSnapshot.availabilityStatus ?? null,
    status: applicationStatusToApi(app.status),
    matchScore: app.matchScore,
    submittedAt: app.submittedAt.toISOString(),
  };
}

export function mapJobOwnerApplicantDetail(
  app: any,
  documentScope: DocumentUrlContext['scope'],
  mapJobDetail: (job: any) => unknown,
) {
  const profileSnapshot = buildSnapshot(app, true);
  const documents = enrichDocuments(app, profileSnapshot, documentScope);
  const attachedDocuments = enrichApplicantDocuments(
    normalizeAttachedDocuments(app.attachedDocuments),
    snapshotContext(app, documentScope),
  );

  return {
    ...mapJobOwnerApplicantListItem(app, documentScope),
    coverNote: app.coverNote ?? null,
    jobSpecificNote: app.coverNote ?? null,
    reviewerNotes: app.employerNotes ?? null,
    employerNotes: app.employerNotes ?? null,
    attachedDocuments,
    profileSnapshot: { ...profileSnapshot, documents },
    liveProfile: null,
    job: mapJobDetail(app.job),
  };
}

export function mapWorkerPublicProfileFromApplication(app: any) {
  const profile = app.worker?.workerProfile;
  if (!profile) return null;
  return {
    fullName: profile.fullName,
    professionalTitle: profile.professionalTitle,
    shortBio: profile.shortBio,
    city: profile.city,
    region: profile.region,
    country: profile.country,
    skills: profile.skills ?? [],
    verificationStatus: verificationToApi(profile.verificationStatus),
    photoUrl: app.worker.photoUrl,
    phone: app.worker.phone,
    email: app.worker.email,
  };
}
