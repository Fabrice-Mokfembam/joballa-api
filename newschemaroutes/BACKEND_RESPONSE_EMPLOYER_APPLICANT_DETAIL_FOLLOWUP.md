# Backend Response: Applicant Detail — Education + Always-Visible Fields

**Date:** 2026-06-07  
**To:** Joballa web frontend (`joballa-web-copy`)  
**Status:** Implemented — ready after deploy  
**Route:** `GET /employer/applicants/:applicationId`  
**Follows:** [BACKEND_RESPONSE_EMPLOYER_APPLICANT_DETAIL.md](./BACKEND_RESPONSE_EMPLOYER_APPLICANT_DETAIL.md)

---

## Summary

Applicant detail now includes **`educations[]`** in `profileSnapshot`, keeps **worker documents separate from apply attachments**, exposes **`coverNote` + `jobSpecificNote`** (same value), and enriches legacy rows from live worker relations (education, CV, supporting docs) on read — same pattern as work history.

---

## What changed

| Area | Before | After |
| --- | --- | --- |
| Education | Not in snapshot | `educations[]` at apply + normalize + live `educationItems` fallback |
| Documents | Attached files merged into `profileSnapshot.documents` | **`documents[]`** = worker CV + supporting docs only; **`attachedDocuments[]`** top-level only |
| CV | Often missing on legacy apps | Included from `cvUrl` / `generatedCvUrl` when present |
| Apply note | `coverNote` only | **`coverNote`** and **`jobSpecificNote`** (alias, same string) |
| Skills | Full list in snapshot | Unchanged — full `skills[]` on detail (list still uses `topSkills` slice) |

**Code:**

- `src/modules/v2/employer/employer-applicant-snapshot.util.ts` — `ApplicantEducationEntry`, `mapEducationRow`, CV doc helper, separate document arrays
- `src/modules/v2/worker/worker-v2.service.ts` — fetch `education` at apply
- `src/modules/v2/employer/employer-v2.service.ts` — `educationItems` in include; detail mapper split

---

## `educations[]` on `profileSnapshot`

```ts
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

type ApplicantProfileSnapshot = {
  // ...existing fields...
  educations?: EducationEntry[];
};
```

Mapped from `worker_profiles` education rows (`education` table) at apply time. Legacy snapshots coerce `educations`, `education`, or `educationItems` JSON; if still empty, server fills from live **`worker.educationItems`**.

---

## Documents — separate arrays

| Array | Source | Purpose |
| --- | --- | --- |
| `profileSnapshot.documents[]` | `supportingDocuments`, `cvUrl`, `generatedCvUrl` | Worker profile / CV library |
| `attachedDocuments[]` (top-level) | Application `attachedDocuments` JSON at apply | Job-specific uploads |

Each entry: `{ name, fileName, type, size?, url }` — never bare UUIDs.

Frontend should **merge both arrays client-side** for the supporting-documents section (as today).

---

## Apply note

```json
{
  "coverNote": "I can start next Monday.",
  "jobSpecificNote": "I can start next Monday."
}
```

Both fields returned when the worker submitted a note; either may be read by the UI.

---

## Acceptance

| # | Check | Status |
| --- | --- | --- |
| 1 | Applicant with CV → `documents[]` non-empty with downloadable `url` | Done |
| 2 | Applicant with education → `educations[]` non-empty | Done |
| 3 | Applicant with apply note → `coverNote` / `jobSpecificNote` present | Done |
| 4 | Full `skills[]` on snapshot (not only matched subset) | Done |
| 5 | Legacy applications enriched on read | Done |

---

## Verification

Smoke assertions in `scripts/v2-routes/03-employer.mjs`:

- `profileSnapshot.educations` non-empty (live fallback for legacy seed)
- `profileSnapshot.documents` with at least one `url`
- `coverNote` or `jobSpecificNote` present

---

## Frontend action

- Parse **`educations[]`** (alias **`education[]`** still supported in your parser).
- Merge **`profileSnapshot.documents`** + **`attachedDocuments`** in UI — backend no longer merges them.
- Read **`coverNote`** or **`jobSpecificNote`** for the application note section.

No route or path changes.
