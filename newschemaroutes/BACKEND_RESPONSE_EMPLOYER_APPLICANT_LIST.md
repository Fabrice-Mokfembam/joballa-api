# Backend Response: Employer Applicant List — Display Name & Headline

**Date:** 2026-06-07  
**To:** Joballa web frontend (`joballa-web-copy`)  
**Status:** Implemented — ready after deploy  
**Related routes:** `GET /employer/applicants`, `GET /employer/dashboard` → `recentApplicants[]`

---

## Summary

The employer applicant **list mapper** now resolves display identity from the **application `profileSnapshot` first**, then live worker profile fields. Login email is **never** used as `workerName`. A new **`workerHeadline`** field is returned on every list item (including dashboard preview cards).

---

## What changed

| Item | Before | After |
| --- | --- | --- |
| `workerName` | `workerProfile.fullName` → **email** → phone | `profileSnapshot.fullName` → profile `fullName` → composed first/last → phone → `"Worker"` |
| Email as name | Possible when profile name empty | **Blocked** — email exposed only as `workerEmail` |
| `workerHeadline` | Not returned | `profileSnapshot.headline` → `profileSnapshot.professionalTitle` → `workerProfile.professionalTitle` |
| `topSkills` | Live profile only | Snapshot `skills[]` preferred, else profile skills |
| `workerLocation` | Live profile city/region | Snapshot city/region preferred, else profile |
| Dashboard | Same broken mapper | Uses **same** `mapApplicant()` as list |

**Code:** `src/modules/v2/employer/employer-applicant-display.util.ts` + `mapApplicant()` in `employer-v2.service.ts`

---

## Updated list item contract

Used by:

- `GET /employer/applicants` (paginated `data[]`)
- `GET /employer/dashboard` → `recentApplicants[]`
- `GET /employer/applicants/:applicationId` (includes all list fields via spread)

```ts
type EmployerApplicantListItem = {
  id: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  workerId: string;

  workerName: string;              // MUST NOT be email when snapshot/profile has a name
  workerHeadline?: string | null;  // card subtitle
  workerEmail?: string | null;     // optional — use for support, not card title

  workerPhotoUrl?: string | null;
  workerLocation?: string | null;
  topSkills: string[];
  verificationStatus: string;
  availabilityStatus?: string | null;
  status: "submitted" | "shortlisted" | "hired" | "rejected";
  matchScore?: number | null;
  submittedAt: string;
};
```

---

## Example response (corrected)

```json
{
  "applicationId": "a1b2c3d4-…",
  "workerName": "Fabrice Mokfembam",
  "workerHeadline": "Frontend Developer, Marketer",
  "workerEmail": "fabricemokfembam@gmail.com",
  "workerPhotoUrl": "https://…",
  "workerLocation": "Douala, Littoral",
  "topSkills": ["React", "javascript", "html"],
  "matchScore": 72,
  "submittedAt": "2026-06-06T14:22:00.000Z",
  "jobTitle": "Frontend Engineer (React / Next.js)",
  "verificationStatus": "verified",
  "status": "submitted"
}
```

---

## Name / headline resolution order (server)

### `workerName`

1. `profileSnapshot.fullName`
2. `workerProfile.fullName`
3. `profileSnapshot.firstName` + `lastName` (or profile equivalents)
4. `users.phone`
5. `"Worker"` — **never** `users.email`

### `workerHeadline`

1. `profileSnapshot.headline` (if present on snapshot JSON)
2. `profileSnapshot.professionalTitle`
3. `workerProfile.professionalTitle`
4. `null`

`jobTitle` is unchanged — it remains the **job posting** title, not the worker headline.

---

## Acceptance criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | List `workerName` is not email when snapshot/profile has a real name | Done |
| 2 | `workerHeadline` present when snapshot has headline / professionalTitle | Done |
| 3 | `jobTitle` unchanged (job posting) | Done |
| 4 | Dashboard `recentApplicants` uses same mapper | Done |
| 5 | Detail route compatible; list `workerName` matches snapshot `fullName` when snapshot exists | Done |

---

## Frontend action

No API path changes. After backend deploy:

1. Keep reading `workerHeadline` on cards (already wired).
2. Optional: use `workerEmail` only in detail/support UI, not as fallback display name.
3. Defensive email rejection in `resolve-applicant-display.ts` can stay; should no longer trigger on list items once deployed.

---

## Verification

**Smoke test** (`scripts/v2-routes/03-employer.mjs`):

- Asserts first applicant `workerName` does not contain `@`
- Asserts `workerHeadline` is present when seeded snapshot includes `professionalTitle`

**Manual (production):**

```http
GET /employer/applicants?limit=3
Authorization: Bearer <employer token>
```

Confirm `workerName` is a person name and `workerHeadline` is populated for workers with `professionalTitle` in their apply-time snapshot.

---

## Documentation updated

- `newschemaroutes/FRONTEND_EMPLOYER_ROUTES.md` → `EmployerApplicantListItem`
- `newschemaroutes/EMPLOYER_ROUTES.md` → same type

---

## Notes on legacy applications

Applications submitted **before** workers completed `fullName` on profile may still show `"Worker"` if neither snapshot nor profile contains a name. Re-applying or backfilling snapshots is a data fix, not an API regression. Email will **not** appear as `workerName` in those cases either.
