# Backend Response: Worker Profile, Applications, CV & Notifications (June 2026)

**Date:** 2026-06-09  
**To:** Joballa worker frontend + backend teams  
**Status:** Implemented on `development`  
**Migration:** `20260609120000_worker_profile_june_2026`  
**Baseline:** [FRONTEND_WORKER_ROUTES.md](./FRONTEND_WORKER_ROUTES.md) (v2 `/worker/*` module)

This document is the **implementation response** to *Backend Requirements: Worker Profile, Applications, CV & Notifications*. It uses the same contract format as the admin response docs.

---

## How to read this document

Each route section has:

1. **What it does** — server behaviour  
2. **Auth** — Bearer token (worker role) unless noted  
3. **Sends** — path params, query params, JSON body (exact keys)  
4. **Receives** — success JSON shape  
5. **Errors** — common failures  

**Base path (worker):** `/worker`  
**Production:** `https://joballa-api.onrender.com`  
**Local:** `http://127.0.0.1:8000`

---

## Shared contracts

### Headers (protected routes)

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Paginated list

```ts
type WorkerPaged<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
```

### Profile completeness (weighted — totals 100)

```ts
type ProfileCompletenessBreakdown = {
  personalInfo: number;    // 0–20
  summary: number;         // 0–10
  skills: number;          // 0–15
  experience: number;      // 0–20
  education: number;       // 0–10
  certifications: number;  // 0–10
  verification: number;    // 0–10  (KYC VERIFIED)
  languages: number;       // 0–5
};

type WorkerFullProfile = {
  profileCompleteness: number;  // sum of breakdown
  profileCompletenessBreakdown: ProfileCompletenessBreakdown;
  profileStrengthBreakdown: ProfileCompletenessBreakdown;  // alias
  availableForHire: boolean;   // read-only, derived
  // ...other fields
};
```

**Apply gate:** `profileCompleteness >= 60` **and** `verificationStatus === "verified"`.

Supporting documents are **excluded** from completeness scoring.

---

## Database changes (migration)

| Change | Detail |
| --- | --- |
| `application_profile_drafts` | New table — per-job customize-before-apply JSON (`customized_data`) |

```bash
npx prisma migrate deploy
npx prisma generate
```

---

## 1. Worker availability & Available for Hire

### Derivation rules (server-side only)

| `availabilityStatus` | `availableForHire` |
| --- | --- |
| `AVAILABLE` | `true` |
| `OPEN_TO_OFFERS` | `true` |
| `NOT_AVAILABLE` | `false` |
| null / other | `false` |

`availableForHire` is **never** accepted on write.

---

### GET `/worker/profile` · GET `/worker/me` · GET `/worker/profile/:workerId/public`

**Receives (added field on profile objects):**

```ts
{
  availabilityStatus: string | null;
  availableForHire: boolean;  // derived
}
```

`GET /worker/me` includes `availableForHire` under `workerProfile`.

---

### PATCH `/worker/profile/personal-info` (and `PUT/PATCH /worker/profile`)

**Sends:**

```ts
{
  availabilityStatus?: string;  // e.g. "AVAILABLE", "NOT_AVAILABLE", "OPEN_TO_OFFERS"
  // availableForHire — NOT accepted
}
```

**Errors:** `400 BAD_REQUEST` — `availableForHire is read-only. Update availabilityStatus instead.`

---

## 2. Certifications — credential URL & edit

### Shared type

```ts
type WorkerCertification = {
  id: string;
  name: string;
  issuer?: string | null;
  issueDate?: string | null;      // ISO date YYYY-MM-DD
  expiryDate?: string | null;
  credentialUrl?: string | null;    // HTTPS only
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

### Validation (`POST` / `PATCH /worker/profile/certifications[/:certId]`)

| Field | Rules |
| --- | --- |
| `credentialUrl` | Optional. `https://` only. Max 2048 chars. Rejects `http://`, localhost, private IPs, URL shorteners |
| `name` | Required on create |

---

### POST `/worker/profile/certifications`

**Sends:**

```ts
{
  name: string;              // required
  issuer?: string;
  credentialUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  description?: string;
}
```

**Receives:** `WorkerCertification` row (triggers completeness recompute).

**Errors:** `400` — invalid `credentialUrl` or missing `name`.

---

### PATCH `/worker/profile/certifications/:certificationId`

**Sends:** Same fields as create (all optional).

**Receives:** Full `GET /worker/profile` object.

---

### DELETE `/worker/profile/certifications/:certificationId`

**Receives:** `{ ok: true }`

---

## 3. Supporting documents

### POST `/worker/profile/documents`

**What it does:** Multipart upload (`file` field).

**Allowed MIME types:**

| Extension | MIME |
| --- | --- |
| PDF | `application/pdf` |
| JPG/JPEG | `image/jpeg` |
| PNG | `image/png` |

**Errors:** `400` — unsupported MIME type (via `FileTypeValidationPipe`).

---

### Document response shape

```ts
type WorkerDocument = {
  id: string;
  type: string;        // from documentLabel or "OTHER"
  fileName: string;
  url: string;         // HTTPS view URL (Cloudinary secure URL)
  mimeType?: string;
  fileType: "pdf" | "image";
  createdAt: string;
};
```

Returned on `GET /worker/profile` as `supportingDocuments` and `GET /worker/profile/documents`.

**Completeness:** Supporting documents do **not** affect `profileCompleteness`.

---

## 4. KYC verification states

### Canonical worker-facing states

| UI | API `status` |
| --- | --- |
| Not submitted | `not_submitted` |
| Under review | `pending` / `under_review` |
| Verified | `verified` |
| Rejected / resubmit | `rejected` / `changes_requested` |

---

### GET `/worker/profile/kyc`

**Receives:**

```ts
{
  id?: string;
  status: "not_submitted" | "pending" | "verified" | "rejected" | "changes_requested" | "under_review";
  kycType?: string;
  frontUrl?: string;
  backUrl?: string | null;
  selfieUrl?: string;
  createdAt?: string;
}
```

When no submission exists: `{ status: "not_submitted" }`.

---

### POST `/worker/profile/kyc`

**What it does:** Creates submission, sets profile `verificationStatus` to `pending`, emits `kyc_submitted` notification.

**Sends:**

```ts
{
  kycType: "national_id" | "passport" | "drivers_license";
  frontUrl: string;
  backUrl?: string;
  selfieUrl: string;
}
```

**Receives:** Submission object with lowercase `status` and `kycType`.

---

### GET `/worker/profile` · GET `/worker/me`

Include top-level `verificationStatus` synced with latest KYC outcome.

---

## 5. Profile sub-resource ordering

Work history, education, and certifications are returned **most recent first**:

1. `endDate` DESC (`isCurrent` / null end → treated as max date; certifications use `expiryDate`)
2. `createdAt` DESC (tie-breaker)

Applies on:

- `GET /worker/profile`
- `GET /worker/profile/:workerId/public`
- Application `profileSnapshot` at apply time

### Edit routes (confirmed)

| Resource | PATCH |
| --- | --- |
| Work history | `/worker/profile/work-history/:workId` |
| Education | `/worker/profile/education/:educationId` |
| Certification | `/worker/profile/certifications/:certificationId` |

---

## 6. Payment methods redesign

### Shared type

```ts
type WorkerPaymentMethod = {
  id: string;
  provider: "mtn_momo" | "orange_money";
  phoneNumber: string;
  isPrimary: boolean;
  createdAt: string;
};
```

### Rules

- Multiple accounts per worker
- Exactly one `isPrimary: true` (setting primary clears others — transactional)
- First account defaults to primary if `isPrimary` omitted
- Public profile omits all payment fields

---

### GET `/worker/profile/payment-accounts`

**Receives:** `WorkerPaymentMethod[]` ordered primary first.

Also exposed on `GET /worker/profile` as `paymentMethods` and `paymentAccounts` (alias).

---

### POST `/worker/profile/payment-accounts`

**Sends:**

```ts
{
  provider: "MTN_MOMO" | "ORANGE_MONEY";  // case-insensitive
  phoneNumber?: string;
  phone?: string;        // alias
  isPrimary?: boolean;
}
```

**Receives:** Created `WorkerPaymentMethod`.

---

### PATCH `/worker/profile/payment-accounts/:accountId`

**Sends:**

```ts
{
  phoneNumber?: string;
  phone?: string;
  isPrimary?: boolean;
}
```

**Receives:** Full `GET /worker/profile`.

---

### DELETE `/worker/profile/payment-accounts/:accountId`

**Receives:** `{ ok: true }`

---

## 7. Profile completeness — weighted scoring

See [Shared contracts](#shared-contracts) for breakdown shape.

### Example

```json
{
  "profileCompleteness": 82,
  "profileStrengthBreakdown": {
    "personalInfo": 20,
    "summary": 10,
    "skills": 12,
    "experience": 15,
    "education": 10,
    "certifications": 10,
    "verification": 0,
    "languages": 5
  }
}
```

### Apply gate — POST `/worker/jobs/:jobId/apply`

**Errors:**

- `403 FORBIDDEN` — `KYC verification is required before applying.`
- `403 FORBIDDEN` — `Profile completeness is X%. A minimum of 60% is required to apply.`

---

## 8. Notifications system

### Notification object

```ts
type WorkerNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  isRead: boolean;       // alias
  createdAt: string;
  deepLink?: string | null;
  metadata?: { relatedId?: string; relatedType?: string };
};
```

### API type mapping (worker-facing)

| Trigger | API `type` |
| --- | --- |
| Application submitted | `application_submitted` |
| KYC submitted | `kyc_update` |
| Payment received | `payment_received` |
| Engagement update | `contract_update` |

Additional employer/admin triggers (application status, payments, engagements) can be wired incrementally.

---

### GET `/worker/notifications`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  type?: string;       // NotificationType enum value
  unreadOnly?: boolean | "true";
}
```

**Receives:** `WorkerPaged<WorkerNotification>`

---

### GET `/worker/notifications/unread-count` **(NEW)**

**Receives:**

```ts
{ count: number }
```

---

### PATCH `/worker/notifications/:notificationId/read`

**Receives:** Updated `WorkerNotification`.

---

### PATCH `/worker/notifications/read-all` **(NEW)**

**Receives:** `{ ok: true }`

---

### GET `/worker/settings/notifications` · PATCH `/worker/settings/notifications`

Unchanged — preference toggles (`inAppEnabled`, `applicationUpdates`, etc.).

### Triggers implemented (v1)

| Event | Notification |
| --- | --- |
| `POST /worker/jobs/:jobId/apply` | Application submitted |
| `POST /worker/profile/kyc` | KYC submitted |

---

## 9. Saved jobs persistence

### Job card fields (list + detail)

```ts
{
  saved: boolean;        // canonical
  isSaved: boolean;      // alias
  savedByViewer: boolean; // legacy alias
}
```

---

### GET `/worker/jobs` · GET `/worker/jobs/:jobId`

Both include `saved` / `isSaved` from `saved_jobs` table.

---

### POST `/worker/jobs/:jobId/save` · DELETE `/worker/jobs/:jobId/save`

**Receives:** `{ jobId: string; saved: boolean }`

---

### GET `/worker/saved-jobs`

All items return `saved: true`. Stays in sync with per-job flags.

---

## 10. Apply flow & application profile snapshot

### POST `/worker/jobs/:jobId/apply`

**Sends:**

```ts
{
  coverNote?: string;
  jobSpecificNote?: string;   // alias for coverNote
  source?: "web" | "mobile_app" | "mobile";
  attachedDocuments?: Array<{
    requestedDocumentKey?: string;
    supportingDocumentId?: string;
  }>;
}
```

**What it does:**

1. Validates KYC `verified` + completeness ≥ 60%
2. Loads per-job draft if exists (`application_profile_drafts`)
3. Builds `profileSnapshot` (master profile + customizations + detached section IDs)
4. Stores application; deletes draft
5. Emits application-submitted notification

**Errors:**

- `409 CONFLICT` — `You have already applied to this job.`

---

### Per-job profile customization (does not mutate master profile)

**Draft storage:** `application_profile_drafts.customized_data` JSON.

```ts
type CustomizeProfileBody = {
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
```

---

### GET `/worker/jobs/:jobId/application/profile` **(NEW)**

**Receives:**

```ts
{
  id?: string;
  applicationId: null;
  jobId: string;
  profileId?: string;
  customizedData: CustomizeProfileBody | null;
  createdAt?: string;
  updatedAt?: string;
}
```

---

### PUT `/worker/jobs/:jobId/application/profile` **(NEW)**

**Sends:** `CustomizeProfileBody`

**Receives:** Draft object (same shape as GET with timestamps).

---

### POST `/worker/jobs/:jobId/application/customize-profile`

**What it does:** Alias for `PUT .../application/profile` (backward compatibility).

---

## 11. CV generation & storage

### GET `/worker/profile/cv-export/status`

**Receives:**

```ts
type WorkerCvExportStatus = {
  available: boolean;
  documentId: string | null;
  fileName: string | null;
  generatedAt: string | null;
  sourceProfileUpdatedAt: string | null;
  isOutdated: boolean;
  downloadUrl: string | null;  // "/worker/profile/cv-export" when available
};
```

Raw Cloudinary URLs are **not** exposed in JSON.

---

### POST `/worker/profile/cv-export`

**Receives:** `application/pdf` binary (regenerates and replaces previous export).

**Headers:** `Content-Disposition: attachment; filename="joballa-cv-....pdf"`

---

### GET `/worker/profile/cv-export`

**Receives:** `application/pdf` binary (cached export).

---

## 12. API summary

### New endpoints

| Method | Path | Priority |
| --- | --- | --- |
| GET | `/worker/notifications/unread-count` | High |
| PATCH | `/worker/notifications/read-all` | Medium |
| GET | `/worker/jobs/:jobId/application/profile` | High |
| PUT | `/worker/jobs/:jobId/application/profile` | High |
| POST | `/worker/jobs/:jobId/application/customize-profile` | High |
| GET | `/worker/profile/payment-accounts` | Medium |
| GET | `/worker/profile/:workerId/public` | Medium |

### Changed behaviour

| Area | Change |
| --- | --- |
| Profile completeness | Weighted 100-point breakdown (§7) |
| `availableForHire` | Server-derived (§1) |
| Certifications | `credentialUrl` HTTPS validation (§2) |
| Documents | PDF/JPG/PNG; excluded from completeness (§3) |
| Payment | Multi-account + single primary (§6) |
| Job cards | Consistent `saved` flag (§9) |
| CV export | `downloadUrl` on status (§11) |
| Sub-resources | Sorted most-recent-first (§5) |
| Apply | KYC + 60% gate; per-job snapshot (§10) |

### Backward compatibility

- `paymentAccounts` alias kept alongside `paymentMethods`
- `profileStrengthBreakdown` alias for numeric `profileCompletenessBreakdown`
- `coverNote` / `jobSpecificNote` interchangeable on apply
- `savedByViewer` kept alongside `saved` / `isSaved`

---

## Requirements checklist

| # | Requirement | Status |
| --- | --- | --- |
| 1 | `availableForHire` derived from `availabilityStatus` | Done |
| 2 | Certifications `credentialUrl` + PATCH edit | Done |
| 3 | Document MIME types; excluded from completeness | Done |
| 4 | KYC states normalized on profile + `/profile/kyc` | Done |
| 5 | Sub-resources sorted most-recent-first | Done |
| 6 | Payment multi-account + single primary | Done |
| 7 | Weighted profile completeness (100%) | Done |
| 8 | Notifications unread-count + read-all + v1 triggers | Done |
| 9 | Consistent `saved` on job list/detail | Done |
| 10 | Apply snapshot + per-job customize draft | Done |
| 11 | CV `downloadUrl` on status | Done |
| 12 | Apply gate: 60% + KYC verified | Done |

---

## Implementation map

| Area | Files |
| --- | --- |
| Service / routes | `src/modules/v2/worker/worker-v2.service.ts`, `worker-v2.controller.ts` |
| Completeness | `worker-profile-completeness.util.ts` |
| Availability | `worker-availability.util.ts` |
| Credential URL | `worker-credential-url.util.ts` |
| Sub-resource sort | `worker-subresource-sort.util.ts` |
| Apply draft | `worker-application-draft.util.ts`, `ApplicationProfileDraft` model |
| Snapshot | `employer-applicant-snapshot.util.ts` |
| CV export | `worker-cv-export.service.ts` |
| Notifications | `worker-notification.util.ts` |
| Migration | `prisma/migrations/20260609120000_worker_profile_june_2026/` |

---

## Frontend references

- Types: `features/worker/types/worker-portal.ts`
- API client: `features/worker/api/worker-portal.live.ts`
- Route doc: [FRONTEND_WORKER_ROUTES.md](./FRONTEND_WORKER_ROUTES.md)
