# Backend Response: Worker Job Management & Applicant Parity

**Date:** 2026-06-14  
**To:** Joballa web + mobile frontends  
**Status:** Implemented  
**Routes:** `PATCH /worker/posted-jobs/:jobId/status`, `POST /worker/posted-jobs`, `POST /worker/posted-jobs/:jobId/publish`, `PATCH /worker/applicants/:id/status`, `GET/PATCH /worker/workforce`, apply/customize profile

---

## Summary

Workers can post and manage jobs with the same moderation flow as employers: drafts stay private, submissions enter **`under_review`**, and only admin-approved jobs become **`active`**. Workers manage applicants and hired workforce for jobs they own. Job responses now include **`postedByType`** (`worker` | `company`) so discovery UI can distinguish poster type. Apply-time **`profileSnapshot`** is immutable; job owners see snapshot only until hire.

---

## `postedByType` on Job

| Value | Set when | API value |
| --- | --- | --- |
| `WORKER` | `POST /worker/posted-jobs` | `"worker"` |
| `COMPANY` | `POST /employer/jobs` | `"company"` |

Exposed on:

- `GET /worker/posted-jobs`, `GET /worker/posted-jobs/:jobId`
- `GET /worker/jobs`, `GET /worker/jobs/:jobId` (discovery)
- `GET /employer/jobs`, `GET /employer/jobs/:jobId`
- Admin job list/detail (`mapJobRow`)

Existing rows backfilled from owner role (`worker` → `worker`, else `company`).

---

## `POST /worker/posted-jobs` — create & draft workflow

| `asDraft` | `status` | Worker-visible (browse) | Admin queue |
| --- | --- | --- | --- |
| `true` | `draft` | No | No |
| `false` | **`under_review`** | **No** | **Yes** |

### Submit for review (`asDraft: false`)

```json
{
  "jobId": "uuid",
  "status": "under_review",
  "submissionScore": {
    "score": 90,
    "tier": "auto_approved"
  },
  "message": "Job submitted. Joballa admin will review before going live."
}
```

### Save draft (`asDraft: true`)

```json
{
  "jobId": "uuid",
  "status": "draft",
  "submissionScore": { "score": 0, "tier": "yellow_zone" },
  "message": "Job saved as draft."
}
```

New worker-posted jobs set `postedByType: "worker"`.

---

## `POST /worker/posted-jobs/:jobId/publish`

Publishes a **draft** or **rejected** job for admin review.

- Optional body: same fields as `PATCH /worker/posted-jobs/:jobId` (merged before validation).
- Validates required publish fields via `validateJobForPublish`.
- Transitions **`draft` / `rejected` → `under_review`**.
- Does **not** set `active` — admin approval required.

```json
{
  "jobId": "uuid",
  "status": "under_review",
  "message": "Job submitted for review. Joballa admin will review before it goes live."
}
```

---

## `PATCH /worker/posted-jobs/:jobId/status`

| Target status | Allowed by worker? |
| --- | --- |
| `closed` | Yes |
| `paused` | **Mapped to `closed`** (worker panel has no pause UX) |
| `active` | **Only from `paused`** (resume an already-approved job) |
| `active` from `under_review` / `draft` / `rejected` | **No** — `400` with moderation message |
| `draft` | Yes (subject to existing edit rules) |

Workers **cannot** self-activate jobs pending admin review.

---

## `PATCH /worker/applicants/:applicationId/status`

Mirrors employer applicant management for jobs the worker owns.

**Body:**

```json
{
  "status": "shortlisted" | "hired" | "rejected" | "submitted",
  "note": "optional employerNotes"
}
```

- `hired` creates/updates a `WorkEngagement` for workforce tracking.
- Applicant list/detail returns **`profileSnapshot` only** while `status !== "hired"`.
- After `hired`, live worker profile may appear in workforce views.

---

## `GET /worker/workforce` & `PATCH /worker/workforce/:workerId/status`

### List — `GET /worker/workforce`

Query: `page`, `limit`, optional `status` (`active` | `completed` | `terminated`).

Paginated engagements where the authenticated worker is the **employer** (job owner).

### Detail — `GET /worker/workforce/:workerId`

Returns engagement summary plus `profileSnapshot`, `publicProfile`, `taskNotes`, `terminationReason`, and `payments`.

### Update status — `PATCH /worker/workforce/:workerId/status`

```json
{
  "engagementId": "uuid",
  "status": "active" | "completed" | "terminated",
  "reason": "optional termination reason"
}
```

---

## Profile snapshot rules (apply / customize)

### Customize draft — `PUT/PATCH /worker/jobs/:jobId/application/profile`

- Saves per-job customize data in `application_profile_drafts`.
- **Merge semantics:** incoming body is merged with existing `customizedData`; only keys present in the request overwrite prior values (detach lists, bio, skills, etc. are preserved across partial saves).
- Draft is deleted after successful apply.

### Apply — `POST /worker/jobs/:jobId/apply`

1. Builds snapshot from live worker profile (`buildApplicantProfileSnapshot`).
2. Applies customize draft if present (`applyCustomizeToSnapshot`).
3. Persists snapshot on `Application.profileSnapshot` — **immutable** after submit.
4. Worker cannot apply to own job (`400`).
5. Job owner (worker or employer) sees **snapshot only** in applicant inbox until `hired`.

### Document detach by id

Customize `detachedDocumentIds` accepts supporting-document **ids**. Snapshot documents include `id` on entries sourced from `supporting_documents`. Detach filter checks `doc.id`, `doc.name`, and `doc.url`.

---

## Field validation limits (customize / apply)

Aligned with web `FIELD_LIMITS`:

| Field | Max length | Endpoint |
| --- | --- | --- |
| Bio / `professionalSummary` | 2000 | customize + apply (via draft) |
| `coverNote` / `jobSpecificNote` | 500 | apply |

Exceeding limits returns `400 Bad Request` with a descriptive message.

---

## Admin approval

Unchanged — `PATCH /admin/jobs/:id/approve` transitions **`under_review` → `active`**. Only then do worker-posted jobs appear in `GET /worker/jobs` browse.

---

## Frontend impact

- Use `postedByType` on job cards/detail to badge worker-posted vs company jobs.
- Posted-jobs list: handle `rejectionReason` on cards (already exposed).
- Customize form: partial PATCH merges — no need to resend full detach lists.
- Apply note: enforce 500-char limit client-side (`Math.min(500, fieldMaxLength("notes"))`).

---

## Verification

- Worker posted job create → `under_review` when `asDraft: false`
- `PATCH .../status` with `paused` → `closed`
- Customize merge retains prior detach ids when only bio is sent
- Apply rejects `coverNote` > 500 chars
- `postedByType` present on job list responses

---

## Related

- [BACKEND_RESPONSE_EMPLOYER_JOB_MODERATION.md](./BACKEND_RESPONSE_EMPLOYER_JOB_MODERATION.md)
- [FRONTEND_PM_PLATFORM_REVIEW.md](./FRONTEND_PM_PLATFORM_REVIEW.md)
- [BACKEND_RESPONSE_EMPLOYER_APPLICANT_DETAIL_FOLLOWUP.md](./BACKEND_RESPONSE_EMPLOYER_APPLICANT_DETAIL_FOLLOWUP.md)
