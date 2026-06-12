# Backend Response: Employer Applicant Detail — Complete `profileSnapshot`

**Date:** 2026-06-07  
**To:** Joballa web frontend (`joballa-web-copy`)  
**Status:** Implemented — ready after deploy  
**Route:** `GET /employer/applicants/:applicationId`  
**Follows:** [BACKEND_RESPONSE_EMPLOYER_APPLICANT_LIST.md](./BACKEND_RESPONSE_EMPLOYER_APPLICANT_LIST.md)

---

## Summary

Employer applicant **detail** now returns a **normalized, UI-ready `profileSnapshot`** on every request. Apply-time capture (`POST /worker/jobs/:jobId/apply`) stores the same shape. Legacy applications (old raw worker `profile()` blobs) are **coerced on read** and enriched from live worker relations when snapshot fields are missing.

---

## What changed

| Area | Before | After |
| --- | --- | --- |
| Apply capture | Raw worker `profile()` JSON (`workExperiences`, `shortBio`, no phone) | `buildApplicantProfileSnapshot()` — employer review contract |
| Detail response | Raw stored JSON passthrough | `normalizeApplicantProfileSnapshot()` on every read |
| Headline | Could show tagline/bio if stored in `headline` | **`professionalTitle` first**; ignores headline when it equals summary/bio |
| Work history | Missing on list/detail UI | `workHistory` + `workHistories` (aliases) |
| Documents | Missing or bare URLs | `documents[]` with `name`, `type`, `url` |
| Phone / languages | Often missing | `phone`, `languages`, `languagesSpoken[]` |
| Summary block | Only `availabilityStatus` | `summary` / `bio` / `professionalSummary`, `industries`, `availability`, `preferredJobTypes[]` |
| Skills highlight | None | `highlightedSkills[]` = job `requiredSkills` ∩ worker skills |
| `attachedDocuments` | Opaque JSON | Normalized `{ name, fileName, type, url, size? }[]` at top level (**not** merged into snapshot docs) |

**Code:**

- `src/modules/v2/employer/employer-applicant-snapshot.util.ts` — build + normalize
- `src/modules/v2/worker/worker-v2.service.ts` — apply-time snapshot
- `src/modules/v2/employer/employer-v2.service.ts` — detail mapper + richer `applicationInclude`

---

## Detail response contract

```ts
type EmployerApplicantDetail = EmployerApplicantListItem & {
  coverNote?: string | null;
  employerNotes?: string | null;
  attachedDocuments: ApplicantDocumentEntry[];
  profileSnapshot: ApplicantProfileSnapshot;
  job: EmployerJobDetail;
};
```

### `ApplicantProfileSnapshot`

```ts
type ApplicantProfileSnapshot = {
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

  languages?: string | null;           // "English, French"
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

  workHistory?: WorkHistoryEntry[];
  workHistories?: WorkHistoryEntry[];   // alias — same array

  educations?: EducationEntry[];

  documents?: ApplicantDocumentEntry[];
  snapshotAt?: string;
};

type WorkHistoryEntry = {
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

type EducationEntry = {
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

type ApplicantDocumentEntry = {
  name: string;
  fileName?: string;
  type?: string;
  size?: string | number | null;
  url?: string;
};
```

---

## Example — normalized detail snapshot

```json
{
  "fullName": "MOKFEMBAM KONGNYUY",
  "headline": "Frontend Developer",
  "professionalTitle": "Frontend Developer",
  "avatarUrl": "https://…",
  "verificationStatus": "verified",
  "location": "Douala, Littoral",
  "city": "Douala",
  "region": "Littoral",
  "country": "Cameroon",
  "phone": "+2376…",
  "languages": "English, French",
  "languagesSpoken": ["English", "French"],
  "summary": "Experienced React developer building marketplace products…",
  "professionalSummary": "Experienced React developer building marketplace products…",
  "bio": "Experienced React developer building marketplace products…",
  "industries": ["SOFTWARE_TECH", "DESIGN"],
  "availability": "available · Full-time, part-time",
  "preferredJobTypes": ["full_time", "part_time"],
  "availabilityStatus": "AVAILABLE",
  "skills": ["React", "javascript", "html", "css", "typescript"],
  "highlightedSkills": ["React", "javascript", "html"],
  "workHistory": [
    {
      "company": "Acme Labs",
      "companyName": "Acme Labs",
      "role": "Frontend Developer",
      "jobTitle": "Frontend Developer",
      "description": "Built customer dashboards in Next.js.",
      "period": "Jan 2024 – Present",
      "startDate": "2024-01-01",
      "endDate": null,
      "location": "Douala"
    }
  ],
  "workHistories": [ "…same as workHistory…" ],
  "documents": [
    {
      "name": "Fabrice-CV.pdf",
      "fileName": "Fabrice-CV.pdf",
      "type": "pdf",
      "url": "https://…"
    }
  ],
  "snapshotAt": "2026-06-07T12:00:00.000Z"
}
```

---

## Headline fix

Resolution order (list **`workerHeadline`** and snapshot **`headline`**):

1. `profileSnapshot.professionalTitle`
2. `workerProfile.professionalTitle` (fallback on read)
3. Legacy `profileSnapshot.headline` **only if it differs from summary/bio**

**Not used for headline:** `summary`, `bio`, `shortBio`, taglines, or company slogans.

If a worker’s DB `professionalTitle` is literally a slogan (e.g. “Inspire and Innovate”), that is **profile data** — employers should correct the worker profile or re-apply after profile update.

---

## Legacy applications

Existing rows stored as raw worker `profile()` output are normalized on read:

| Legacy field | Normalized to |
| --- | --- |
| `workExperiences[]` | `workHistory` / `workHistories` |
| `supportingDocuments[]` | `documents[]` |
| `shortBio` | `summary`, `bio`, `professionalSummary` |
| `languages[]` | `languagesSpoken`, `languages` string |
| `preferredJobCategories[]` | `industries` |

If snapshot is still sparse, server fills from **live** `workExperiences` and `supportingDocuments` on the worker user (read-only enrichment — DB snapshot row is not mutated).

---

## Acceptance criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | `summary` populated when worker has bio | Done |
| 2 | `industries` populated from preferred job categories | Done |
| 3 | `workHistory` ≥1 entry when worker has work history | Done (snapshot or live fallback) |
| 4 | `documents` / `attachedDocuments` with name + url | Done |
| 5 | `phone` on snapshot when user has phone | Done |
| 6 | Headline = professional title, not bio | Done |
| 7 | `highlightedSkills` from job match | Done |
| 8 | List route fields unchanged | Done |

---

## Verification

```http
GET /employer/applicants/:applicationId
Authorization: Bearer <employer token>
```

Smoke assertions added in `scripts/v2-routes/03-employer.mjs`:

- `profileSnapshot.fullName` present and not an email
- `summary` / `bio` / `professionalSummary` present
- `workHistory` or `workHistories` non-empty

---

## Frontend action

- Continue using `coerceProfileSnapshot` / `parseApplicantDetailProfile` — both normalized and legacy shapes are supported.
- Prefer **`profileSnapshot.documents`** for worker CV/supporting docs; merge with top-level **`attachedDocuments`** on the client.
- Use **`highlightedSkills`** for bold skill pills; fallback logic on frontend still works.

**Follow-up (2026-06-07):** [BACKEND_RESPONSE_EMPLOYER_APPLICANT_DETAIL_FOLLOWUP.md](./BACKEND_RESPONSE_EMPLOYER_APPLICANT_DETAIL_FOLLOWUP.md) — `educations[]`, separate document arrays, `jobSpecificNote`.

No route or path changes.

---

## Documentation updated

- `newschemaroutes/FRONTEND_EMPLOYER_ROUTES.md` — applicant detail + `ApplicantProfileSnapshot`
- `newschemaroutes/EMPLOYER_ROUTES.md` — same
