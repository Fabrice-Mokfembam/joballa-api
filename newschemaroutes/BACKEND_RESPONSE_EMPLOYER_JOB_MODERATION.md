# Backend Response: Job Submit Enters Admin Review (`under_review`)

**Date:** 2026-06-07  
**To:** Joballa web frontend (`joballa-web-copy`)  
**Status:** Implemented  
**Routes:** `POST /employer/jobs`, `PATCH /employer/jobs/:jobId/status`

---

## Summary

Non-draft job submissions now enter **`under_review`** until admin approval. They are **not** published as **`active`** on create. Worker feeds remain **`active`-only**. Employers **cannot** self-activate jobs via status PATCH (except resuming **`paused`** jobs that were already approved).

---

## `POST /employer/jobs`

| `asDraft` | `status` | Worker-visible | Admin queue |
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
  "rejectionReason": null,
  "changeRequest": null,
  "message": "Job submitted. Joballa admin will review before going live."
}
```

**Note:** `submissionScore.tier` may be `auto_approved` for queue routing — it does **not** skip human review or set `active`.

### Save draft (`asDraft: true`)

```json
{
  "jobId": "uuid",
  "status": "draft",
  "submissionScore": { "score": 0, "tier": "yellow_zone" },
  "message": "Job saved as draft."
}
```

---

## Admin approval

`PATCH /admin/jobs/:id/approve` (existing) transitions **`under_review` → `active`** and sets `approvedAt`. Only then does the job appear in worker browse/apply endpoints.

---

## Employer status PATCH

| Target status | Allowed by employer? |
| --- | --- |
| `active` | **Only from `paused`** (resume an already-approved job) |
| `active` from `under_review` / `draft` / `rejected` | **No** — `400` with moderation message |
| `paused`, `closed`, `draft` | Yes (subject to existing rules) |

---

## Worker feed

Unchanged — only `status: active` jobs in list/detail/apply.

---

## Frontend impact

No request body changes. Optional:

- Toast from `CreateEmployerJobResponse.message`
- Redirect to jobs list filtered **Under review** when `status === "under_review"`

---

## Verification

- Smoke: `scripts/v2-routes/03-employer.mjs` asserts create → `under_review`

---

## Related

- [EMPLOYER_JOB_POSTING_GUIDE.md](./EMPLOYER_JOB_POSTING_GUIDE.md)
- [BACKEND_RESPONSE_EMPLOYER_JOB_EDIT.md](./BACKEND_RESPONSE_EMPLOYER_JOB_EDIT.md)
