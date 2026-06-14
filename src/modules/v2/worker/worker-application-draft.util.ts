import { BadRequestException } from '@nestjs/common';
import type { ApplicantProfileSnapshot } from '../employer/employer-applicant-snapshot.util';

/** Aligned with joballa-web `FIELD_LIMITS`. */
const CUSTOMIZE_FIELD_LIMITS = {
  professionalTitle: 120,
  bio: 2000,
  coverNote: 500,
} as const;

export type CustomizeProfileData = {
  professionalTitle?: string;
  professionalSummary?: string;
  bio?: string;
  skills?: string[];
  languages?: string[];
  region?: string;
  city?: string;
  detachedWorkHistoryIds?: string[];
  detachedEducationIds?: string[];
  detachedCertificationIds?: string[];
  detachedDocumentIds?: string[];
};

export function normalizeCustomizeBody(
  body: Record<string, unknown>,
): CustomizeProfileData {
  return {
    professionalTitle: maybeStr(body.professionalTitle),
    professionalSummary: maybeStr(body.professionalSummary),
    bio: maybeStr(body.bio) ?? maybeStr(body.professionalSummary),
    skills: maybeStrArray(body.skills),
    languages: maybeStrArray(body.languages),
    region: maybeStr(body.region),
    city: maybeStr(body.city),
    detachedWorkHistoryIds: maybeStrArray(body.detachedWorkHistoryIds),
    detachedEducationIds: maybeStrArray(body.detachedEducationIds),
    detachedCertificationIds: maybeStrArray(body.detachedCertificationIds),
    detachedDocumentIds: maybeStrArray(body.detachedDocumentIds),
  };
}

export function mergeCustomizeProfile(
  existing: CustomizeProfileData | null | undefined,
  incoming: CustomizeProfileData,
): CustomizeProfileData {
  const merged: CustomizeProfileData = { ...(existing ?? {}) };
  const keys: (keyof CustomizeProfileData)[] = [
    'professionalTitle',
    'professionalSummary',
    'bio',
    'skills',
    'languages',
    'region',
    'city',
    'detachedWorkHistoryIds',
    'detachedEducationIds',
    'detachedCertificationIds',
    'detachedDocumentIds',
  ];
  for (const key of keys) {
    if (incoming[key] !== undefined) {
      (merged as Record<string, unknown>)[key] = incoming[key];
    }
  }
  return merged;
}

export function validateCustomizeProfileLimits(
  data: CustomizeProfileData,
): void {
  if (
    data.professionalTitle &&
    data.professionalTitle.length > CUSTOMIZE_FIELD_LIMITS.professionalTitle
  ) {
    throw new BadRequestException(
      `Professional title must be at most ${CUSTOMIZE_FIELD_LIMITS.professionalTitle} characters.`,
    );
  }
  const summary = data.professionalSummary ?? data.bio;
  if (summary && summary.length > CUSTOMIZE_FIELD_LIMITS.bio) {
    throw new BadRequestException(
      `Bio / professional summary must be at most ${CUSTOMIZE_FIELD_LIMITS.bio} characters.`,
    );
  }
}

export function validateCoverNoteLimit(coverNote: string | undefined): void {
  if (coverNote && coverNote.length > CUSTOMIZE_FIELD_LIMITS.coverNote) {
    throw new BadRequestException(
      `Cover note must be at most ${CUSTOMIZE_FIELD_LIMITS.coverNote} characters.`,
    );
  }
}

export function applyCustomizeToSnapshot(
  snapshot: ApplicantProfileSnapshot,
  customized: CustomizeProfileData,
): ApplicantProfileSnapshot {
  const detachedWork = new Set(customized.detachedWorkHistoryIds ?? []);
  const detachedEdu = new Set(customized.detachedEducationIds ?? []);
  const detachedCert = new Set(customized.detachedCertificationIds ?? []);
  const detachedDoc = new Set(customized.detachedDocumentIds ?? []);

  const summary =
    customized.professionalSummary ??
    customized.bio ??
    snapshot.summary ??
    snapshot.professionalSummary;

  const filterDetached = <
    T extends { id?: string; name?: string; url?: string },
  >(
    rows: T[] | undefined,
    detached: Set<string>,
    idKey: (row: T) => string | undefined,
  ) =>
    (rows ?? []).filter((row) => {
      const id = idKey(row);
      if (id && detached.has(id)) return false;
      return true;
    });

  const workHistory = filterDetached(
    snapshot.workHistory as Array<{ id?: string }> | undefined,
    detachedWork,
    (r) => r.id,
  ) as ApplicantProfileSnapshot['workHistory'];

  const educations = filterDetached(
    snapshot.educations as
      | Array<{ id?: string; institution?: string }>
      | undefined,
    detachedEdu,
    (r) => r.id,
  ) as ApplicantProfileSnapshot['educations'];

  const certifications = filterDetached(
    snapshot.certifications as
      | Array<{ id?: string; name?: string }>
      | undefined,
    detachedCert,
    (r) => r.id,
  ) as ApplicantProfileSnapshot['certifications'];

  const documents = (snapshot.documents ?? []).filter((doc) => {
    if (doc.id && detachedDoc.has(doc.id)) return false;
    if (doc.name && detachedDoc.has(doc.name)) return false;
    if (doc.url && detachedDoc.has(doc.url)) return false;
    return true;
  });

  return {
    ...snapshot,
    professionalTitle:
      customized.professionalTitle ?? snapshot.professionalTitle,
    headline:
      customized.professionalTitle ??
      snapshot.headline ??
      snapshot.professionalTitle,
    professionalSummary: summary ?? snapshot.professionalSummary,
    summary: summary ?? snapshot.summary,
    bio: summary ?? snapshot.bio,
    skills: customized.skills?.length ? customized.skills : snapshot.skills,
    languagesSpoken: customized.languages?.length
      ? customized.languages
      : snapshot.languagesSpoken,
    languages: customized.languages?.length
      ? customized.languages.join(', ')
      : snapshot.languages,
    city: customized.city ?? snapshot.city,
    region: customized.region ?? snapshot.region,
    location:
      [customized.city ?? snapshot.city, customized.region ?? snapshot.region]
        .filter(Boolean)
        .join(', ') || snapshot.location,
    workHistory,
    workHistories: workHistory,
    educations,
    certifications,
    documents,
    customizedForJob: true,
  };
}

function maybeStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function maybeStrArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.map(String) : undefined;
}
