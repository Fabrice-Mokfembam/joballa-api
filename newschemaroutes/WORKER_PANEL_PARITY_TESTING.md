# Worker Panel Parity — Where to Test

**Date:** 2026-06-14  
**Scope:** API + web + mobile (worker-as-job-owner parity with employer)

---

## Why you might see “only ~10 files changed”

Work landed in **multiple agent sessions**, not one commit. Cursor may show only the **latest batch** in the diff (e.g. backend-only or one subagent summary). The full parity work touches **~35+ files** across three packages. Run `git status` from repo root after pulling latest to see everything uncommitted.

---

## Prerequisite

```bash
cd joballa-api
npx prisma migrate deploy   # applies posted_by_type migration
# restart API
```

---

## API — new/changed routes

| Route | Test |
|-------|------|
| `PATCH /worker/posted-jobs/:jobId/status` | Body `{ "status": "closed" }` on your live job |
| `POST /worker/posted-jobs/:jobId/publish` | Draft → pending review |
| `GET /worker/posted-jobs/:jobId` | Draft/rejected detail + `rejectionReason` |
| `PATCH /worker/applicants/:applicationId/status` | `{ "status": "shortlisted" \| "rejected" \| "hired", "note"? }` |
| `GET /worker/workforce` | List hired workers on jobs you posted |
| `PATCH /worker/workforce/:workerId/status` | `{ "status": "terminated", "engagementId", "reason"? }` |
| `POST /worker/jobs/:jobId/apply` | `profile_snapshot` stored; customize does not mutate profile |

Job responses include **`postedByType`**: `"worker"` \| `"company"`.

Full contract: [`BACKEND_RESPONSE_WORKER_JOB_MANAGEMENT_JUNE_2026.md`](./BACKEND_RESPONSE_WORKER_JOB_MANAGEMENT_JUNE_2026.md)

---

## Web — screens to test

| Area | Path / component | What to verify |
|------|------------------|----------------|
| My jobs | `/worker/my-jobs?job={id}` | Draft detail, Publish, Close, rejection banner |
| Post / edit job | `/worker/jobs/new?edit={jobId}` | Loads existing draft/job |
| Incoming applicant | `/worker/applications/incoming/{id}` | Shortlist / Reject (note) / Hire; profile = **snapshot only** |
| Apply flow | Job detail → Apply | Char limits; detach work exp → main profile unchanged |
| Employer applicant (regression) | `/employer/applicants/{id}` | No “Current profile” block; snapshot only |

Key files: `worker-owned-job-detail-view.tsx`, `worker-incoming-applicant-detail-panel.tsx`, `worker-post-job-flow.tsx`, `employer-applicant-detail-panel.tsx`

---

## Mobile — screens to test

| Area | Screen | What to verify |
|------|--------|----------------|
| Posted jobs | Jobs tab → tap any posted job | Opens **owned job detail** (including draft) |
| Owned job detail | `/owned-job-detail?jobId=` | Publish, Close, rejection reason, Edit |
| Edit job | Post job with `?edit=` | Hydrates from API |
| Incoming applicant | Applications → incoming | Status buttons; snapshot sections |
| Workforce | Jobs tab → Workforce | Terminate/reinstate via `/worker/workforce` |
| Apply | Apply flow | Note local-only until submit; char limits on customize |

Key files: `owned-job-detail-screen.tsx`, `incoming-applicant-screen.tsx`, `workforce-tab-content.tsx`, `apply-screen.tsx`, `applicant-profile.ts`

---

## `profile_snapshot` format (apply-time)

Stored on `applications.profile_snapshot` at submit. Reviewers (employer **or** worker job owner) always receive **snapshot only** — `liveProfile` is `null`.

**Included at apply:**
- `fullName`, `professionalTitle`, `professionalSummary` / `bio`
- `skills`, `highlightedSkills`, `languages` / `languagesSpoken`
- `workHistory` / `workHistories` — each row has `id`, `company`/`companyName`, `role`/`jobTitle`, `description`, `period`, dates
- `educations` — each row has `id`, `institution`, `degree`, `fieldOfStudy`, dates
- `certifications` — each row has `id`, `name`, `issuer`, `issueDate`, `expiryDate`, **`credentialUrl`**
- `documents` — each row has `id`, `name`, `url`, optional `downloadUrl`
- `customizedForJob: true` when apply customize draft was merged
- `snapshotAt` ISO timestamp

**Customize-for-role (apply draft):** merges text overrides + **detaches** sections by id (`detachedWorkHistoryIds`, `detachedEducationIds`, `detachedCertificationIds`, `detachedDocumentIds`). Does **not** mutate the worker’s live profile.

**Frontend parsers:**
- Web: `features/employer/lib/applicant-profile.ts` (`parseApplicantDetailProfile`)
- Mobile: `src/features/worker/lib/applicant-profile.ts` (`parseApplicantDetailProfile`)

**Quick DB check after apply:**
```sql
SELECT profile_snapshot->'certifications', profile_snapshot->'workHistory', profile_snapshot->'documents'
FROM applications ORDER BY created_at DESC LIMIT 1;
```

---

## End-to-end checklist

1. **Draft job** — create → view detail (web panel + mobile detail) → Publish → status pending review  
2. **Admin reject** — `rejectionReason` visible on owned job detail  
3. **Live job** — Close → new applications blocked  
4. **Applicant** — worker owner shortlists / rejects with note / hires → workforce row appears  
5. **Workforce** — terminate worker on mobile Workforce tab  
6. **Apply snapshot** — customize (detach work history + cert + doc) → submit → main profile still full; reviewer sees trimmed snapshot with **cert URLs** and **document download links**  
7. **`postedByType`** — worker-owned job API returns `"worker"`

---

## Files changed (inventory)

### API (`joballa-api`) — 10 files
- `prisma/schema.prisma`
- `prisma/migrations/20260614120000_job_posted_by_type/migration.sql`
- `src/modules/v2/worker/worker-v2.controller.ts`
- `src/modules/v2/worker/worker-v2.service.ts`
- `src/modules/v2/worker/worker-application-draft.util.ts`
- `src/modules/v2/employer/employer-v2.service.ts`
- `src/modules/v2/employer/employer-applicant-snapshot.util.ts`
- `src/modules/v2/shared/api-format.ts`
- `src/modules/v2/admin/admin-mappers.ts`
- `newschemaroutes/BACKEND_RESPONSE_WORKER_JOB_MANAGEMENT_JUNE_2026.md`

### Web (`joballa-web`) — 14 files
- `features/worker/api/worker-portal.live.ts`
- `features/worker/hooks/use-worker-owned-jobs.ts`
- `features/worker/hooks/index.ts`
- `features/worker/query-keys.ts`
- `features/worker/types/worker-portal.ts`
- `features/worker/lib/worker-job-status.ts` *(new)*
- `components/worker/worker-owned-job-detail-view.tsx`
- `components/worker/worker-incoming-applicant-detail-panel.tsx`
- `components/worker/worker-post-job-flow.tsx`
- `components/worker/worker-apply-flow.tsx`
- `components/worker/worker-application-profile-customize.tsx`
- `components/employer/employer-applicant-detail-panel.tsx`
- `app/[locale]/(worker)/worker/jobs/new/page.tsx`
- `messages/en.json`

### Mobile (`joballa-mobile`) — 14 files
- `src/features/worker/api/worker-portal.ts`
- `src/features/worker/hooks/use-worker-queries.ts`
- `src/features/worker/hooks/query-keys.ts`
- `src/features/worker/lib/job-display.ts`
- `src/features/worker/lib/job-payload.ts`
- `src/shared/lib/field-limits.ts` *(new)*
- `src/features/jobs/screens/owned-job-detail-screen.tsx` *(new)*
- `app/(protected)/(stack)/owned-job-detail.tsx` *(new)*
- `src/core/navigation/routes.ts`
- `src/features/jobs/screens/jobs-screen.tsx`
- `src/features/jobs/screens/post-job-screen.tsx`
- `src/features/jobs/screens/incoming-applicant-screen.tsx`
- `src/features/jobs/screens/apply-screen.tsx`
- `src/features/jobs/components/workforce-tab-content.tsx`
- `src/features/jobs/components/application-profile-customize-view.tsx`
- `src/features/jobs/screens/workforce-worker-screen.tsx`

**Total: ~38 files** (3 new docs/migrations/screens on top of modified files)
