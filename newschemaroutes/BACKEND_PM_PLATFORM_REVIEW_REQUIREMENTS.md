# Backend Requirements: PM Platform Review (June 2026)

**Date:** 2026-06-10  
**Status:** **IMPLEMENTED — see [FRONTEND_PM_PLATFORM_REVIEW.md](./FRONTEND_PM_PLATFORM_REVIEW.md)**  
**Sources:** PM walkthrough notes + voice clarification on worker-posted jobs & profile snapshots  
**Audience:** Product, frontend, backend

### Confirmed decisions

| ID | Decision |
| --- | --- |
| **Q1** | **Option A** — workers post full jobs (`POST /worker/jobs`, draft → publish), same `jobs` table as employers |
| **Q2** | **Publish → `under_review`** — not live; user submits to admin review queue |
| **Q8** | **Worker-posted jobs** — same admin approval as employer jobs; only admins set `active` |
| **Q3** | **Live profile** for job owner only when `status === hired` |
| **Q4** | **Applicant saving** — status workflow only (shortlist/reject/hire), no bookmarks |
| **Q5** | **Document URLs** — API `downloadUrl` paths on applicant/application detail |
| **Q6** | **Apply preview** — existing customize draft routes (`GET/PUT .../application/profile`) |
| **Q7** | **Worker applies to worker-posted job** — yes (cannot apply to own job) |
| **Q9** | **Informal requests** — kept alongside full posted jobs |

**Job lifecycle (employer + worker):**

```
draft  →  publish  →  under_review  →  admin approves  →  active
```

---

## How to use this document

1. Read each **requirement** and **proposed behaviour**.  
2. Check **Current backend** vs **Gap**.  
3. Mark ✅ approve or ✏️ change in your reply.  
4. Answer **Open questions** at the end.

Contract format matches [FRONTEND_EMPLOYER_ROUTES.md](./FRONTEND_EMPLOYER_ROUTES.md) / [FRONTEND_WORKER_ROUTES.md](./FRONTEND_WORKER_ROUTES.md).

---

## Product model (confirmed understanding)

### Two roles on the same `jobs` table

| Actor | Action | Sees |
| --- | --- | --- |
| **Employer** | Posts job | Applicants to their jobs |
| **Worker** | Can also post job | **Their own applicants** (people who applied to jobs they posted) |
| **Worker** | Applies to someone else's job | Their application status; snapshot they submitted |
| **Anyone** | Applies to a job | Profile frozen in `applications.profileSnapshot` at apply time |

### Profile snapshot rule (core)

```
Master profile (/worker/profile)     → never changed by apply/customize
Per-job draft (optional)             → worker edits preview before apply
applications.profileSnapshot       → frozen at POST apply
Employer / job-owner views applicant → snapshot ONLY (until hired — see Q3)
Applicant views own application      → same snapshot JSON they submitted
```

**Customize flow (worker applying to employer job):**

1. Worker opens job apply page → sees **preview** of profile.  
2. **Customize** button → edit fields for **this job only** (bio, skills, detach sections, etc.).  
3. **Apply** → backend merges master + customizations → stores `profileSnapshot`.  
4. Employer sees **customized snapshot**, not live profile.

---

## Requirements checklist

| # | Requirement | Priority |
| --- | --- | --- |
| R1 | Employer draft jobs in My Jobs; publish later; validate only on publish | High |
| R2 | Employer manage applicants (list, view, update status, notes) | High |
| R3 | Worker sees application status per job they applied to | High |
| R4 | Worker posts jobs and sees **their** applicants | High |
| R5 | Customize-before-apply; snapshot only for reviewer | High |
| R6 | Application detail returns **full** snapshot JSON (docs, certs, URLs) | High |
| R7 | PDFs / documents return browser-openable URLs | High |
| R8 | CV export reliable (generate, download, no raw broken links) | High |
| R9 | Reviewer sees live profile only after accept/hire | Medium |

---

## R1 — Employer draft jobs & publish

### Requirement

- Draft jobs appear under **My Jobs** (`status: draft`).
- Employer can **save incomplete** jobs as draft.
- **No full validation on save** — only when changing status to **publish** (submit for review / go live per product rules).
- Publish runs all required-field checks (title, department, pay, description, etc.).

### Current backend

| Item | State |
| --- | --- |
| `POST /employer/jobs` with `asDraft: true` | Creates `DRAFT` job |
| `GET /employer/jobs?status=draft` | Returns drafts |
| `POST /employer/jobs/:jobId/draft` | Updates job (partial) |
| `PATCH /employer/jobs/:jobId/status` | Status changes |
| Validation on draft create | **Still strict** (`requireDepartmentId`, required enums) |

### Proposed behaviour

| Action | Validation |
| --- | --- |
| `POST /employer/jobs` + `asDraft: true` | Minimal: optional title; allow null/empty optional fields |
| `PATCH /employer/jobs/:jobId` while `draft` | Same — partial updates OK |
| `POST /employer/jobs/:jobId/publish` **(new)** or `PATCH status: under_review` | **Full** validation; reject with field errors if incomplete |

### Proposed contract — publish

**`POST /employer/jobs/:jobId/publish`**

**Sends:** path `jobId` only (or final body if merging draft fields).

**Receives:**

```ts
{
  jobId: string;
  status: "under_review";  // admin approval queue (current non-draft flow)
  message: string;
}
```

**Errors:** `400` with `{ message, fieldErrors?: Record<string, string[]> }` when required fields missing.

**Confirmed:** Publish always → `under_review`; admin-only go-live.

---

## R2 — Employer applicant management

### Requirement

- List applicants for employer's jobs.
- View applicant detail.
- Update status: `submitted` → `shortlisted` → `hired` / `rejected`.
- Optional notes.

### Current backend

| Route | Status |
| --- | --- |
| `GET /employer/applicants` | ✅ |
| `GET /employer/applicants/:applicationId` | ✅ (via list + detail pattern) |
| `PATCH /employer/applicants/:applicationId/status` | ✅ |
| `PATCH /employer/applicants/:applicationId/notes` | ✅ |

### Gap

- Applicant detail may **blend live worker profile** into display when snapshot is thin (see R5/R6).
- Frontend may not wire all statuses.

**Proposed:** No new routes; fix snapshot-only display + notifications on status change (optional).

---

## R3 — Worker: my application status

### Requirement

Worker sees **status of each application** they submitted (to employer or worker-posted jobs).

### Current backend

| Route | Returns |
| --- | --- |
| `GET /worker/applications` | `status` per row |
| `GET /worker/applications/:applicationId` | detail + `profileSnapshot` |
| `GET /worker/jobs/:jobId` | `viewerApplication.status` when already applied |
| `GET /worker/jobs/applications` | **Alias** added → same as applications list |

### Gap

- Frontend route confusion (fixed alias on backend).
- Status labels / filters on UI.

**Proposed:** Document canonical path `GET /worker/applications`; keep alias for legacy.

---

## R4 — Worker posts jobs & sees their applicants

### Requirement (from voice note)

> Workers can post jobs. People apply to those jobs. **Workers see their own applicants** — same idea as employer applicant inbox, but job `ownerId` is a worker user.

### Current backend

| Item | State |
| --- | --- |
| `jobs.ownerId` | Any `users.id` (schema allows worker owner) |
| `POST /employer/jobs` | **Employer role only** |
| Worker job posting | `POST /worker/informal-requests` only (request → admin may assign job) |
| Worker applicant APIs | **Missing** — no `GET /worker/applicants` |

### Proposed behaviour — **Option A confirmed**

Worker-owned jobs use same `jobs` + `applications` tables as employers.

1. Worker job routes (mirror employer):
   - `POST /worker/jobs` — create (`asDraft: true` → `draft`)
   - `GET /worker/jobs` — my posted jobs (drafts, under_review, active, etc.)
   - `PATCH /worker/jobs/:jobId` — partial update while draft
   - `POST /worker/jobs/:jobId/publish` — full validation → `under_review`
2. Worker applicant routes (mirror employer):
   - `GET /worker/applicants` — applications where `job.ownerId = me`
   - `GET /worker/applicants/:applicationId`
   - `PATCH /worker/applicants/:applicationId/status`
   - `PATCH /worker/applicants/:applicationId/notes`

**Informal requests:** `POST /worker/informal-requests` may remain as a separate “request help” path; **primary** worker hiring flow is full jobs (Option A).

### Proposed contract sketch — worker applicants list

**`GET /worker/applicants`**

**Auth:** Bearer, role `worker`, must own the job.

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  jobId?: string;
  status?: "submitted" | "shortlisted" | "hired" | "rejected";
  search?: string;
}
```

**Receives:** Same card shape as employer applicants, but `reviewerRole: "worker"` and snapshot-only profile.

---

## R5 — Customize before apply & snapshot-only for reviewer

### Requirement

| Step | Behaviour |
| --- | --- |
| Preview | Worker sees profile preview on apply page |
| Customize | Edits stored per job; **master profile unchanged** |
| Apply | `profileSnapshot` = resolved profile at apply time |
| Employer / worker job-owner views applicant | **`profileSnapshot` only** — not `GET /worker/profile` live data |

### Current backend

| Item | State |
| --- | --- |
| `GET /worker/jobs/:jobId/application/profile` | Load draft |
| `PUT /worker/jobs/:jobId/application/profile` | Save customize draft |
| `POST /worker/jobs/:jobId/application/customize-profile` | Alias |
| `POST /worker/jobs/:jobId/apply` | Merges draft → snapshot |
| Employer `mapApplicantDetail` | Returns `profileSnapshot` but **normalization fills gaps from live worker** |

### Proposed changes

1. **`normalizeApplicantProfileSnapshot`:** When serving employer/worker reviewer, add flag `snapshotOnly: true` — **do not** merge live worker fields except metadata (application id, status).
2. **List cards:** Use snapshot fields only for name, photo, skills headline.
3. **Worker application detail:** Return `profileSnapshot` as stored; add `previewProfile` endpoint separate from apply if UI needs live preview before customize.

### Proposed contract — apply page preview (optional new)

**`GET /worker/jobs/:jobId/apply-preview`**

**Receives:**

```ts
{
  masterProfile: WorkerFullProfile;           // live profile for preview
  customizedDraft: CustomizeProfileBody | null;
  resolvedPreview: ApplicantProfileSnapshot;  // what employer would see if they applied now
}
```

**Please confirm:** Is `GET application/profile` + client-side merge enough, or do you want `apply-preview`?

---

## R6 — Full snapshot JSON on application detail

### Requirement

When viewing application details (worker **or** employer/job-owner), `profileSnapshot` must include:

- Personal info, summary, skills, languages, location  
- Work history, education  
- **Certifications** (with `credentialUrl`)  
- **Supporting documents** with **working `url`** for each file  
- `attachedDocuments` from apply body  
- `snapshotAt` timestamp  

Worker must see **the same JSON** they submitted.

### Current backend

| Item | State |
| --- | --- |
| `buildApplicantProfileSnapshot` on apply | Includes work, education, skills, docs, certifications (June update) |
| `applyCustomizeToSnapshot` | Merges customizations |
| `normalizeApplicantProfileSnapshot` on read | May re-fetch live data; may drop cert/doc URLs |
| Detached section IDs | Supported in customize body |

### Proposed snapshot shape (stored & returned)

```ts
type ApplicationProfileSnapshot = {
  fullName: string;
  headline?: string | null;
  professionalTitle?: string | null;
  avatarUrl?: string | null;
  verificationStatus?: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  location?: string | null;
  phone?: string | null;
  summary?: string | null;
  professionalSummary?: string | null;
  bio?: string | null;
  skills: string[];
  highlightedSkills?: string[];
  languagesSpoken?: string[];
  workHistory: Array<{ id?: string; companyName: string; jobTitle: string; period?: string; description?: string | null }>;
  educations: Array<{ id?: string; institution: string; degree?: string | null; fieldOfStudy?: string | null; period?: string }>;
  certifications: Array<{ id?: string; name: string; issuer?: string | null; credentialUrl?: string | null; issueDate?: string | null }>;
  documents: Array<{ name: string; fileName?: string; type?: string; url: string; mimeType?: string }>;
  availabilityStatus?: string | null;
  customizedForJob?: boolean;
  snapshotAt: string;
};
```

**Proposed:** Validation test that apply → get detail returns identical substantive fields.

---

## R7 — PDFs & documents: readable URLs

### Requirement

All PDFs (CV export, supporting documents, attachments) must return URLs that **open in the browser** or download via API — not raw unusable Cloudinary internals.

### Current backend

| Source | URL type |
| --- | --- |
| Supporting documents | `fileUrl` — Cloudinary `secure_url` |
| CV export status | `downloadUrl: "/worker/profile/cv-export"` (relative) |
| CV generate | Binary `application/pdf` on POST/GET |
| Some authenticated Cloudinary assets | May **not** open when pasted in browser |

### Proposed changes

1. **Document response contract** — always include:

```ts
{
  url: string;          // browser-openable HTTPS
  downloadUrl?: string; // API path for forced download
  mimeType: string;
}
```

2. **Optional:** `GET /files/view/:documentId` or signed short-lived URLs for private assets.

3. **Employer applicant documents:** Read URLs from `profileSnapshot.documents[].url` only.

**Please confirm:** Proxy through API vs signed Cloudinary URLs?

---

## R8 — CV export (“CV wahala”)

### Requirement

- Generate CV PDF reliably.
- Download without broken links.
- Regenerate when profile changes (`isOutdated` flag).
- No raw `cloudinary.com/...` in JSON responses.

### Current backend

| Route | State |
| --- | --- |
| `GET /worker/profile/cv-export/status` | `downloadUrl`, `isOutdated` |
| `POST /worker/profile/cv-export` | Binary PDF |
| `GET /worker/profile/cv-export` | Cached PDF download |

### Gap

- Frontend may still use old Cloudinary URL from profile.
- PDF layout quality (PM mentioned readability).

**Proposed:** Frontend uses only `downloadUrl` or binary endpoints; include generated CV in apply snapshot `documents[]` with API URL.

---

## R9 — Live profile only after accept/hire

### Requirement

- **Before hire:** reviewer sees snapshot only.  
- **After hire (`status: hired` / active engagement):** may show **live** worker profile (for workforce / ongoing work).

### Current backend

| Context | Behaviour |
| --- | --- |
| Applicant review | Returns snapshot + implicit live fallbacks |
| `GET /employer/workforce/:workerId` | Returns **both** `profileSnapshot` and `publicProfile` |

### Proposed

```ts
// GET employer/applicants/:id — status !== hired
{ profileSnapshot: ApplicationProfileSnapshot; liveProfile: null }

// GET employer/applicants/:id — status === hired
{ profileSnapshot: ApplicationProfileSnapshot; liveProfile?: WorkerPublicProfile }

// GET employer/workforce/:workerId
{ profileSnapshot: ...; liveProfile: ... }  // unchanged
```

**Please confirm:** Is `hired` the switch point, or first message/contact earlier?

---

## Cross-cutting: who can review applicants?

| Job owner role | Applicant API prefix | Snapshot rule |
| --- | --- | --- |
| `employer` | `/employer/applicants/*` | R5, R6, R9 |
| `worker` | `/worker/applicants/*` **(new)** | Same rules |

Applicant user is always a `worker` (person applying). Job owner can be employer **or** worker.

---

## Implementation phases (after approval)

### Phase 1 — Quick wins (1–2 days)

- R5/R6: Snapshot-only mode for employer applicant detail + enrich apply snapshot  
- R7: Document URL contract + CV `downloadUrl` enforcement  
- R3: Document worker applications routes  

### Phase 2 — Employer jobs (1–2 days)

- R1: Relaxed draft save + `POST .../publish` validation gate  

### Phase 3 — Worker as job poster (3–5 days)

- R4: Worker job CRUD (draft/publish) + worker applicant inbox  
- Reuse employer job validation logic via shared service  

### Phase 4 — Polish

- R8: CV PDF layout  
- Notifications on applicant status change  
- E2E tests for customize → apply → employer view  

---

## Open questions

| ID | Question | Status |
| --- | --- | --- |
| Q1 | Worker job posting: Option A vs B | ✅ **Option A** |
| Q2 | Publish → `under_review` vs `active` | ✅ **`under_review`** |
| Q8 | Worker jobs need admin approval | ✅ **Yes, same as employer** |
| Q3 | Live profile at `hired` only | ✅ |
| Q4 | Status workflow only — no bookmarks | ✅ |
| Q5 | API `downloadUrl` paths | ✅ |
| Q6 | Existing customize draft routes | ✅ |
| Q7 | Worker can apply to worker jobs (not own) | ✅ |
| Q9 | Keep informal requests | ✅ |

---

## Current vs target summary

| Area | Today | Target |
| --- | --- | --- |
| Draft jobs | Strict validation on create | Loose save; validate on publish |
| Worker applicants | Not implemented | Mirror employer applicants |
| Customize → snapshot | Backend exists | Frontend + snapshot-only display |
| Snapshot completeness | Partial | Full docs + certs + URLs |
| PDF URLs | Often raw storage | Openable / API download |
| Reviewer profile source | Snapshot + live fallback | Snapshot only until hired |

---

## Related docs

| Doc | Purpose |
| --- | --- |
| [BACKEND_RESPONSE_WORKER_PROFILE_JUNE_2026_REQUIREMENTS.md](./BACKEND_RESPONSE_WORKER_PROFILE_JUNE_2026_REQUIREMENTS.md) | Customize draft routes (shipped) |
| [FRONTEND_EMPLOYER_ROUTES.md](./FRONTEND_EMPLOYER_ROUTES.md) | Employer contracts |
| [FRONTEND_WORKER_ROUTES.md](./FRONTEND_WORKER_ROUTES.md) | Worker contracts |
| [GOOGLE_SIGNIN_WORKER_EMPLOYER_PLAN.md](./GOOGLE_SIGNIN_WORKER_EMPLOYER_PLAN.md) | Separate track |
| [FRONTEND_PM_PLATFORM_REVIEW.md](./FRONTEND_PM_PLATFORM_REVIEW.md) | **Frontend integration guide (this release)** |

---

## Sign-off

Reply with:

1. **Approved** / **Changes needed** per section (R1–R9)  
2. Answers to **Q1–Q8**  
3. Priority order if different from phases above  

**All items confirmed and implemented. Frontend: use [FRONTEND_PM_PLATFORM_REVIEW.md](./FRONTEND_PM_PLATFORM_REVIEW.md).**
