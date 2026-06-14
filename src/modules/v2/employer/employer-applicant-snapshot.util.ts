import type { EmploymentType } from '@prisma/client';
import { employmentTypeToApi } from '../shared/api-format';

type JsonRecord = Record<string, unknown>;

export type ApplicantCertificationEntry = {
  id?: string;
  name: string;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  credentialUrl?: string | null;
};

export type ApplicantWorkHistoryEntry = {
  id?: string;
  company?: string;
  companyName?: string;
  role?: string;
  jobTitle?: string;
  description?: string | null;
  period?: string;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  city?: string | null;
  region?: string | null;
};

export type ApplicantEducationEntry = {
  id?: string;
  institution: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  period?: string;
  description?: string | null;
  city?: string | null;
  region?: string | null;
};

export type ApplicantDocumentEntry = {
  id?: string;
  name: string;
  fileName?: string;
  type?: string;
  mimeType?: string;
  size?: string | number | null;
  /** Original storage URL (may be Cloudinary). Prefer downloadUrl in UI. */
  url?: string;
  /** Browser-friendly API path — use this for Download buttons. */
  downloadUrl?: string;
};

export type ApplicantProfileSnapshot = {
  fullName: string;
  headline?: string | null;
  professionalTitle?: string | null;
  avatarUrl?: string | null;
  verificationStatus?: string;
  location?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  languages?: string | null;
  languagesSpoken?: string[];
  summary?: string | null;
  professionalSummary?: string | null;
  bio?: string | null;
  industries?: string | string[];
  availability?: string | null;
  preferredJobTypes?: string[];
  availabilityStatus?: string | null;
  skills: string[];
  highlightedSkills?: string[];
  workHistory?: ApplicantWorkHistoryEntry[];
  workHistories?: ApplicantWorkHistoryEntry[];
  educations?: ApplicantEducationEntry[];
  certifications?: ApplicantCertificationEntry[];
  documents?: ApplicantDocumentEntry[];
  customizedForJob?: boolean;
  snapshotAt?: string;
};

type CertificationRow = {
  id?: string;
  name: string;
  issuer?: string | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  credentialUrl?: string | null;
};

type WorkExperienceRow = {
  id?: string;
  companyName: string;
  jobTitle: string;
  location?: string | null;
  startDate: Date;
  endDate?: Date | null;
  isCurrent?: boolean;
  description?: string | null;
};

type EducationRow = {
  id?: string;
  institutionName: string;
  degree?: string | null;
  fieldOfStudy?: string | null;
  startDate: Date;
  endDate?: Date | null;
  isCurrent?: boolean;
  description?: string | null;
  city?: string | null;
  region?: string | null;
};

type SupportingDocumentRow = {
  id?: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  documentLabel?: string | null;
};

type WorkerProfileRow = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  professionalTitle?: string | null;
  shortBio?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  languages?: string[];
  skills?: string[];
  preferredJobCategories?: string[];
  preferredJobTypes?: EmploymentType[];
  availabilityStatus?: string | null;
  verificationStatus?: string;
  cvUrl?: string | null;
  generatedCvUrl?: string | null;
  generatedCvFileName?: string | null;
};

type WorkerUserRow = {
  phone?: string | null;
  photoUrl?: string | null;
  workerProfile?: WorkerProfileRow | null;
  workExperiences?: WorkExperienceRow[];
  educationItems?: EducationRow[];
  supportingDocuments?: SupportingDocumentRow[];
};

function asRecord(value: unknown): JsonRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
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

function formatMonthYear(
  date: Date | string | null | undefined,
): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatWorkPeriod(row: {
  startDate: Date | string;
  endDate?: Date | string | null;
  isCurrent?: boolean;
}): string {
  const start = formatMonthYear(row.startDate);
  const end = row.isCurrent ? 'Present' : formatMonthYear(row.endDate);
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? '';
}

function mapCertificationRow(
  row: CertificationRow,
): ApplicantCertificationEntry {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer ?? null,
    issueDate: row.issueDate?.toISOString?.()?.slice(0, 10) ?? null,
    expiryDate: row.expiryDate?.toISOString?.()?.slice(0, 10) ?? null,
    credentialUrl: row.credentialUrl ?? null,
  };
}

function mapWorkExperienceRow(
  row: WorkExperienceRow,
): ApplicantWorkHistoryEntry {
  const period = formatWorkPeriod(row);
  return {
    id: row.id,
    company: row.companyName,
    companyName: row.companyName,
    role: row.jobTitle,
    jobTitle: row.jobTitle,
    description: row.description ?? null,
    period: period || undefined,
    startDate:
      row.startDate?.toISOString?.()?.slice(0, 10) ??
      String(row.startDate).slice(0, 10),
    endDate: row.endDate
      ? row.endDate instanceof Date
        ? row.endDate.toISOString().slice(0, 10)
        : String(row.endDate).slice(0, 10)
      : null,
    location: row.location ?? null,
  };
}

function normalizeIndustries(value: unknown): string | string[] {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function mapWorkHistoryFromJson(rows: unknown): ApplicantWorkHistoryEntry[] {
  if (!Array.isArray(rows)) return [];
  const mapped: ApplicantWorkHistoryEntry[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    if (!r) continue;
    const companyName =
      nonEmptyString(r.companyName) ?? nonEmptyString(r.company) ?? 'Company';
    const jobTitle =
      nonEmptyString(r.jobTitle) ?? nonEmptyString(r.role) ?? 'Role';
    const startDate = nonEmptyString(r.startDate);
    const endDate = nonEmptyString(r.endDate);
    const period =
      nonEmptyString(r.period) ??
      (startDate
        ? `${startDate}${endDate ? ` – ${endDate}` : r.isCurrent ? ' – Present' : ''}`
        : null);
    mapped.push({
      company: companyName,
      companyName,
      role: jobTitle,
      jobTitle,
      description: nonEmptyString(r.description),
      period: period ?? undefined,
      startDate,
      endDate,
      location: nonEmptyString(r.location),
      city: nonEmptyString(r.city),
      region: nonEmptyString(r.region),
    });
  }
  return mapped;
}

function mapEducationRow(row: EducationRow): ApplicantEducationEntry {
  const period = formatWorkPeriod(row);
  return {
    id: row.id,
    institution: row.institutionName,
    degree: row.degree ?? null,
    fieldOfStudy: row.fieldOfStudy ?? null,
    description: row.description ?? null,
    period: period || undefined,
    startDate:
      row.startDate?.toISOString?.()?.slice(0, 10) ??
      String(row.startDate).slice(0, 10),
    endDate: row.endDate
      ? row.endDate instanceof Date
        ? row.endDate.toISOString().slice(0, 10)
        : String(row.endDate).slice(0, 10)
      : null,
    city: row.city ?? null,
    region: row.region ?? null,
  };
}

function mapEducationFromJson(rows: unknown): ApplicantEducationEntry[] {
  if (!Array.isArray(rows)) return [];
  const mapped: ApplicantEducationEntry[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    if (!r) continue;
    const institution =
      nonEmptyString(r.institution) ??
      nonEmptyString(r.institutionName) ??
      'Institution';
    const startDate = nonEmptyString(r.startDate);
    const endDate = nonEmptyString(r.endDate);
    const period =
      nonEmptyString(r.period) ??
      (startDate
        ? `${startDate}${endDate ? ` – ${endDate}` : r.isCurrent ? ' – Present' : ''}`
        : null);
    mapped.push({
      institution,
      degree: nonEmptyString(r.degree),
      fieldOfStudy: nonEmptyString(r.fieldOfStudy),
      description: nonEmptyString(r.description),
      period: period ?? undefined,
      startDate,
      endDate,
      city: nonEmptyString(r.city),
      region: nonEmptyString(r.region),
    });
  }
  return mapped;
}

function mapDocumentRow(input: {
  id?: string;
  fileName?: string;
  name?: string;
  fileType?: string;
  type?: string;
  fileUrl?: string;
  url?: string;
  fileSize?: string | number | null;
  size?: string | number | null;
  documentLabel?: string | null;
}): ApplicantDocumentEntry | null {
  const name =
    nonEmptyString(input.fileName) ??
    nonEmptyString(input.name) ??
    nonEmptyString(input.documentLabel);
  if (!name) return null;
  const type =
    nonEmptyString(input.fileType)?.toLowerCase() ??
    nonEmptyString(input.type)?.toUpperCase() ??
    undefined;
  const url =
    nonEmptyString(input.fileUrl) ?? nonEmptyString(input.url) ?? undefined;
  return {
    id: nonEmptyString(input.id) ?? undefined,
    name,
    fileName: name,
    type,
    size: input.fileSize ?? input.size ?? null,
    url,
  };
}

function mapDocumentsFromJson(rows: unknown): ApplicantDocumentEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => mapDocumentRow(asRecord(row) ?? {}))
    .filter((row): row is ApplicantDocumentEntry => row !== null);
}

function mapSupportingDocumentRows(
  rows: SupportingDocumentRow[],
): ApplicantDocumentEntry[] {
  return rows
    .map((doc) =>
      mapDocumentRow({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileUrl: doc.fileUrl,
        documentLabel: doc.documentLabel,
      }),
    )
    .filter((doc): doc is ApplicantDocumentEntry => doc !== null);
}

function profileCvDocuments(
  profile: WorkerProfileRow,
): ApplicantDocumentEntry[] {
  const docs: ApplicantDocumentEntry[] = [];
  const cvUrl =
    nonEmptyString(profile.generatedCvUrl) ?? nonEmptyString(profile.cvUrl);
  if (cvUrl) {
    const name =
      nonEmptyString(profile.generatedCvFileName) ??
      cvUrl.split('/').pop()?.split('?')[0] ??
      'CV.pdf';
    docs.push({
      name,
      fileName: name,
      type: 'pdf',
      url: cvUrl,
      size: null,
    });
  }
  return docs;
}

function dedupeDocuments(
  docs: ApplicantDocumentEntry[],
): ApplicantDocumentEntry[] {
  return docs.filter(
    (doc, index, all) =>
      all.findIndex((d) => d.name === doc.name && d.url === doc.url) === index,
  );
}

function humanizeAvailability(
  status: string | null | undefined,
): string | null {
  if (!status) return null;
  return status.replace(/_/g, ' ').toLowerCase();
}

function formatPreferredJobTypes(
  types: EmploymentType[] | string[] | undefined,
): string[] {
  if (!types?.length) return [];
  return types.map((t) =>
    typeof t === 'string' && t.includes('_')
      ? employmentTypeToApi(t as EmploymentType)
      : String(t).toLowerCase(),
  );
}

function formatAvailabilityLine(
  status: string | null | undefined,
  preferredJobTypes: string[],
): string | null {
  const parts = [
    humanizeAvailability(status),
    preferredJobTypes.length
      ? preferredJobTypes
          .map((t) => t.replace(/_/g, ' '))
          .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
          .join(', ')
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function computeHighlightedSkills(
  skills: string[],
  jobRequiredSkills: string[] = [],
): string[] {
  if (!skills.length || !jobRequiredSkills.length) return [];
  const normalizedJob = jobRequiredSkills.map((s) => s.trim().toLowerCase());
  return skills.filter((skill) =>
    normalizedJob.some(
      (required) =>
        skill.toLowerCase() === required ||
        skill.toLowerCase().includes(required) ||
        required.includes(skill.toLowerCase()),
    ),
  );
}

export function normalizeAttachedDocuments(
  raw: unknown,
): ApplicantDocumentEntry[] {
  return mapDocumentsFromJson(raw);
}

function resolveHeadline(
  professionalTitle: string | null,
  shortBio: string | null,
): string | null {
  const title = nonEmptyString(professionalTitle);
  const bio = nonEmptyString(shortBio);
  if (title && bio && title.toLowerCase() === bio.toLowerCase()) {
    return null;
  }
  return title;
}

export function buildApplicantProfileSnapshot(input: {
  user: { phone?: string | null; photoUrl?: string | null };
  profile: WorkerProfileRow;
  workExperiences: WorkExperienceRow[];
  educations: EducationRow[];
  certifications?: CertificationRow[];
  supportingDocuments: SupportingDocumentRow[];
  jobRequiredSkills?: string[];
  snapshotAt?: Date;
}): ApplicantProfileSnapshot {
  const profile = input.profile;
  const fullName =
    nonEmptyString(profile.fullName) ??
    composedName(profile.firstName, profile.lastName) ??
    'Worker';
  const professionalTitle = nonEmptyString(profile.professionalTitle);
  const headline = resolveHeadline(professionalTitle, profile.shortBio ?? null);
  const skills = profile.skills ?? [];
  const preferredJobTypes = formatPreferredJobTypes(profile.preferredJobTypes);
  const languagesSpoken = profile.languages ?? [];
  const workHistory = input.workExperiences.map(mapWorkExperienceRow);
  const educations = input.educations.map(mapEducationRow);
  const certifications = (input.certifications ?? []).map(mapCertificationRow);
  const documents = dedupeDocuments([
    ...mapSupportingDocumentRows(input.supportingDocuments),
    ...profileCvDocuments(profile),
  ]);

  return {
    fullName,
    headline,
    professionalTitle: professionalTitle ?? null,
    avatarUrl: input.user.photoUrl ?? null,
    verificationStatus:
      profile.verificationStatus?.toLowerCase() ?? 'not_submitted',
    city: profile.city ?? null,
    region: profile.region ?? null,
    country: profile.country ?? null,
    location: [profile.city, profile.region].filter(Boolean).join(', ') || null,
    phone: input.user.phone ?? null,
    languages: languagesSpoken.length ? languagesSpoken.join(', ') : null,
    languagesSpoken,
    summary: profile.shortBio ?? null,
    professionalSummary: profile.shortBio ?? null,
    bio: profile.shortBio ?? null,
    industries: normalizeIndustries(profile.preferredJobCategories ?? []),
    preferredJobTypes,
    availabilityStatus: profile.availabilityStatus ?? null,
    availability: formatAvailabilityLine(
      profile.availabilityStatus,
      preferredJobTypes,
    ),
    skills,
    highlightedSkills: computeHighlightedSkills(
      skills,
      input.jobRequiredSkills ?? [],
    ),
    workHistory,
    workHistories: workHistory,
    educations,
    certifications,
    documents,
    snapshotAt: (input.snapshotAt ?? new Date()).toISOString(),
  };
}

/** Coerce stored apply-time JSON (legacy worker profile blob or normalized snapshot) for employer UI. */
function mapCertificationFromJson(
  rows: unknown,
): ApplicantCertificationEntry[] {
  if (!Array.isArray(rows)) return [];
  const mapped: ApplicantCertificationEntry[] = [];
  for (const row of rows) {
    const r = asRecord(row) ?? {};
    const name = nonEmptyString(r.name);
    if (!name) continue;
    mapped.push({
      id: nonEmptyString(r.id) ?? undefined,
      name,
      issuer: nonEmptyString(r.issuer) ?? null,
      issueDate: nonEmptyString(r.issueDate) ?? null,
      expiryDate: nonEmptyString(r.expiryDate) ?? null,
      credentialUrl: nonEmptyString(r.credentialUrl) ?? null,
    });
  }
  return mapped;
}

export function normalizeApplicantProfileSnapshot(
  stored: unknown,
  options: {
    jobRequiredSkills?: string[];
    worker?: WorkerUserRow | null;
    /** When true, return only stored snapshot — no live profile merge. */
    snapshotOnly?: boolean;
  } = {},
): ApplicantProfileSnapshot {
  const snap = asRecord(stored) ?? {};
  const snapshotOnly = options.snapshotOnly === true;
  const profile = snapshotOnly ? null : (options.worker?.workerProfile ?? null);

  const fullName =
    nonEmptyString(snap.fullName) ??
    nonEmptyString(profile?.fullName) ??
    composedName(profile?.firstName, profile?.lastName) ??
    'Worker';

  const summary =
    nonEmptyString(snap.summary) ??
    nonEmptyString(snap.professionalSummary) ??
    nonEmptyString(snap.bio) ??
    nonEmptyString(snap.shortBio) ??
    nonEmptyString(profile?.shortBio);

  const professionalTitle =
    nonEmptyString(snap.professionalTitle) ??
    nonEmptyString(profile?.professionalTitle);

  const legacyHeadline = nonEmptyString(snap.headline);
  const headline =
    professionalTitle ??
    (legacyHeadline && legacyHeadline !== summary ? legacyHeadline : null);

  const languagesSpoken =
    stringArray(snap.languagesSpoken).length > 0
      ? stringArray(snap.languagesSpoken)
      : stringArray(snap.languages).length > 0
        ? stringArray(snap.languages)
        : (profile?.languages ?? []);

  const skills =
    stringArray(snap.skills).length > 0
      ? stringArray(snap.skills)
      : (profile?.skills ?? []);

  const preferredJobTypes =
    stringArray(snap.preferredJobTypes).length > 0
      ? stringArray(snap.preferredJobTypes)
      : formatPreferredJobTypes(profile?.preferredJobTypes);

  const workHistoryRaw =
    snap.workHistory ??
    snap.workHistories ??
    snap.workExperiences ??
    (snapshotOnly ? [] : (options.worker?.workExperiences ?? []));

  const workHistory =
    Array.isArray(workHistoryRaw) &&
    workHistoryRaw.length &&
    typeof workHistoryRaw[0] === 'object' &&
    workHistoryRaw[0] !== null &&
    'companyName' in (workHistoryRaw[0] as object)
      ? (workHistoryRaw as WorkExperienceRow[]).map(mapWorkExperienceRow)
      : mapWorkHistoryFromJson(workHistoryRaw);

  const educationsRaw =
    snap.educations ??
    snap.education ??
    snap.educationItems ??
    (snapshotOnly ? [] : (options.worker?.educationItems ?? []));

  const educations =
    Array.isArray(educationsRaw) &&
    educationsRaw.length &&
    typeof educationsRaw[0] === 'object' &&
    educationsRaw[0] !== null &&
    'institutionName' in (educationsRaw[0] as object)
      ? (educationsRaw as EducationRow[]).map(mapEducationRow)
      : mapEducationFromJson(educationsRaw);

  const certificationsRaw = snap.certifications ?? [];
  const certifications = mapCertificationFromJson(certificationsRaw);

  const documentsRaw =
    snap.documents ??
    snap.supportingDocuments ??
    (snapshotOnly ? [] : (options.worker?.supportingDocuments ?? []));

  const documents = dedupeDocuments([
    ...(Array.isArray(documentsRaw) &&
    documentsRaw.length &&
    typeof documentsRaw[0] === 'object' &&
    documentsRaw[0] !== null &&
    'fileUrl' in (documentsRaw[0] as object)
      ? mapSupportingDocumentRows(documentsRaw as SupportingDocumentRow[])
      : mapDocumentsFromJson(documentsRaw)),
    ...(profile ? profileCvDocuments(profile) : []),
  ]);

  const highlightedSkills =
    stringArray(snap.highlightedSkills).length > 0
      ? stringArray(snap.highlightedSkills)
      : computeHighlightedSkills(skills, options.jobRequiredSkills ?? []);

  const availabilityStatus =
    nonEmptyString(snap.availabilityStatus) ??
    profile?.availabilityStatus ??
    null;

  return {
    fullName,
    headline,
    professionalTitle: professionalTitle ?? headline,
    avatarUrl:
      nonEmptyString(snap.avatarUrl) ??
      nonEmptyString(snap.photoUrl) ??
      options.worker?.photoUrl ??
      null,
    verificationStatus:
      nonEmptyString(snap.verificationStatus) ??
      profile?.verificationStatus?.toLowerCase() ??
      'not_submitted',
    city: nonEmptyString(snap.city) ?? profile?.city ?? null,
    region: nonEmptyString(snap.region) ?? profile?.region ?? null,
    country: nonEmptyString(snap.country) ?? profile?.country ?? null,
    location:
      nonEmptyString(snap.location) ??
      ([
        nonEmptyString(snap.city) ?? profile?.city,
        nonEmptyString(snap.region) ?? profile?.region,
      ]
        .filter(Boolean)
        .join(', ') ||
        null),
    phone:
      nonEmptyString(snap.phone) ??
      nonEmptyString(snap.phoneNumber) ??
      options.worker?.phone ??
      null,
    languages:
      nonEmptyString(snap.languages) ??
      (languagesSpoken.length ? languagesSpoken.join(', ') : null),
    languagesSpoken,
    summary,
    professionalSummary: summary,
    bio: summary,
    industries: normalizeIndustries(
      snap.industries ??
        snap.preferredJobCategories ??
        profile?.preferredJobCategories,
    ),
    preferredJobTypes,
    availabilityStatus,
    availability:
      nonEmptyString(snap.availability) ??
      formatAvailabilityLine(availabilityStatus, preferredJobTypes),
    skills,
    highlightedSkills,
    workHistory,
    workHistories: workHistory,
    educations,
    certifications,
    documents,
    customizedForJob: snap.customizedForJob === true ? true : undefined,
    snapshotAt: nonEmptyString(snap.snapshotAt) ?? undefined,
  };
}

export function mergeApplicantDocuments(
  profileSnapshot: ApplicantProfileSnapshot,
  attachedDocuments: unknown,
): ApplicantDocumentEntry[] {
  const attached = normalizeAttachedDocuments(attachedDocuments);
  const base = profileSnapshot.documents ?? [];
  return dedupeDocuments([...base, ...attached]);
}
