# Joballa Employer Portal — Frontend API Guide

**Last updated:** May 31, 2026  
**Production API:** [https://joballa-api.onrender.com](https://joballa-api.onrender.com)  
**Base path:** `/api/employer`  
**Audience:** Frontend developers building the employer portal (dashboard, jobs, applicants, workforce, payments, company, notifications)

Verified with in-process e2e `npm run test:e2e -- --testPathPatterns=employer-may-2026` and `npm run smoke:employer` (when credentials or `JOBALLA_EMPLOYER_BOOTSTRAP=1` are set).

**Payload reference (frontend audit):** [`docsfromfrontend/EMPLOYER_ROUTES_COMPREHENSIVE.md`](../docsfromfrontend/EMPLOYER_ROUTES_COMPREHENSIVE.md)

**Related:** Admin moderation uses `/admin/*` — see [FRONTEND_ADMIN_PANEL_API_GUIDE_MAY_2026.md](./FRONTEND_ADMIN_PANEL_API_GUIDE_MAY_2026.md). Auth is shared at `/auth/*`. **Login, refresh, logout:** [FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md](./FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md). **Worker portal** (do not use employer routes for worker post-job / incoming applications): [FRONTEND_WORKER_PORTAL_API_GUIDE_MAY_2026.md](./FRONTEND_WORKER_PORTAL_API_GUIDE_MAY_2026.md).

---

## Table of contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Response format & errors](#3-response-format--errors)
4. [Route index (34 routes)](#4-route-index-34-routes)
5. [Session & dashboard](#5-session--dashboard)
6. [Jobs](#6-jobs)
7. [Applicants](#7-applicants)
8. [Workforce & shifts](#8-workforce--shifts)
9. [Payments](#9-payments)
10. [Company profile](#10-company-profile)
11. [Notifications & applicant notes](#11-notifications--applicant-notes)
12. [Status reference](#12-status-reference)
13. [Smoke tests, e2e & env vars](#13-smoke-tests-e2e--env-vars)
14. [Document history](#14-document-history)

---

## 1. Overview

The employer portal API lets **verified employers** (`Role.EMPLOYER`):

- View dashboard metrics and live jobs
- Post and manage jobs (draft → admin review → live)
- Review applicants, shortlist, reject, or **hire**
- Manage hired **workforce**, log **shifts**, terminate/reinstate
- Run **payroll** views and initiate MoMo/OM payments (stored as `PENDING` until provider confirms)
- Update **company profile** and logo

All `/api/employer/*` routes require:

```http
Authorization: Bearer <accessToken>
```

The JWT must belong to a user with role **`EMPLOYER`**. Other roles receive **403 Forbidden**.

Unlike the admin panel, employer routes return **JSON objects directly** (no `{ success, data, message }` wrapper).

---

## 2. Authentication

**Full guide (login, refresh, logout, sample code):** [FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md](./FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md)

### 2.1 Summary

- Login: `POST /auth/login` → store **`accessToken`** and **`refreshToken`** from JSON.
- Refresh: `POST /auth/refresh` with body `{ "refreshToken": "..." }` (recommended from localhost).
- Attach `Authorization: Bearer <accessToken>` on every `/api/employer/*` call.
- On **401**, refresh once, retry; if refresh fails → login page.

Registration: `POST /auth/register` → `POST /auth/verify` (same token shape as login). OTP on production via email/SMS.

---

## 3. Response format & errors

### 3.1 Success

Most endpoints return the resource object or list payload **directly** in the response body (HTTP 2xx).

**Paginated lists** use:

```json
{
  "items": [],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**Job create** returns:

```json
{
  "jobId": "uuid",
  "status": "pending_review",
  "message": "Job submitted. Joballa admin will review before going live."
}
```

**Empty body:** `DELETE` routes return **`204 No Content`** with no JSON body.

### 3.2 Errors (global filter)

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Job is already closed.",
  "path": "/api/employer/jobs/uuid",
  "timestamp": "2026-05-23T18:46:47.263Z"
}
```

| Code | Meaning |
|------|---------|
| `400` | Validation or business rule (see `message`) |
| `401` | Missing or invalid JWT |
| `403` | Not an employer, or not owner of resource |
| `404` | Job, applicant, worker, or payment not found |
| `409` | Conflict (e.g. duplicate application) |
| `500` | Server error |

Validation failures may return `message` as a **string array** of field errors.

---

## 4. Route index (34 routes)

| # | Method | Route | Purpose |
|---|--------|-------|---------|
| 1 | GET | `/api/employer/me` | Current employer + company summary |
| 2 | GET | `/api/employer/dashboard` | Stat cards + live jobs preview |
| 3 | POST | `/api/employer/jobs` | Create job (submit or draft) |
| 4 | GET | `/api/employer/jobs` | List employer jobs |
| 5 | GET | `/api/employer/jobs/:jobId` | Job detail / preview |
| 6 | PATCH | `/api/employer/jobs/:jobId` | Update job fields |
| 7 | PATCH | `/api/employer/jobs/:jobId/status` | Pause, close, activate |
| 8 | POST | `/api/employer/jobs/:jobId/draft` | Save as draft |
| 9 | DELETE | `/api/employer/jobs/:jobId` | Delete job (not when closed) |
| 10 | GET | `/api/employer/applicants/filters` | Filter dropdown values |
| 11 | GET | `/api/employer/applicants` | List applicants |
| 12 | GET | `/api/employer/applicants/:applicationId` | Applicant detail + snapshot |
| 13 | PATCH | `/api/employer/applicants/:applicationId/status` | Shortlist / reject / hire |
| 14 | PATCH | `/api/employer/applicants/:applicationId/notes` | Save `employerNotes` on application |
| 15 | GET | `/api/employer/applicants/:applicationId/share` | Shareable profile link |
| 16 | GET | `/api/employer/workforce` | Hired workers list + stats |
| 17 | GET | `/api/employer/workforce/:workerId` | Worker detail |
| 18 | GET | `/api/employer/workforce/:workerId/shifts` | Shift log |
| 19 | POST | `/api/employer/workforce/:workerId/shifts` | Log a shift |
| 20 | PATCH | `/api/employer/workforce/:workerId/shifts/:shiftId` | Edit shift |
| 21 | DELETE | `/api/employer/workforce/:workerId/shifts/:shiftId` | Delete shift |
| 22 | PATCH | `/api/employer/workforce/:workerId/status` | Terminate / reinstate |
| 23 | GET | `/api/employer/payments` | Payroll summary cards |
| 24 | GET | `/api/employer/payments/workers` | Workers pay table |
| 25 | POST | `/api/employer/payments/pay` | Pay one worker |
| 26 | GET | `/api/employer/payments/history` | Payment history |
| 27 | GET | `/api/employer/payments/:paymentId` | Payment detail |
| 28 | GET | `/api/employer/payments/statement` | Statement data (PDF hook) |
| 29 | GET | `/api/employer/company` | Company profile |
| 30 | PATCH | `/api/employer/company` | Update company |
| 31 | POST | `/api/employer/company/logo` | Upload logo (multipart) |
| 32 | GET | `/api/employer/notifications` | In-app notifications (`?filter=all\|applicants\|payments`) |
| 33 | PATCH | `/api/employer/notifications/:id/read` | Mark one read |
| 34 | PATCH | `/api/employer/settings/notifications` | Toggle prefs (in-memory until persisted) |

### Worker portal migration (important)

The worker app must **stop** calling employer routes for worker-owned flows:

| Stop using (employer) | Use instead (worker) |
|----------------------|----------------------|
| `POST /api/employer/jobs` | `POST /api/worker/jobs` |
| `GET /api/employer/applicants` | `GET /api/worker/jobs/applications` |

---

## 5. Session & dashboard

### 5.1 `GET /api/employer/me`

| | |
|---|---|
| **Purpose** | Sidebar identity, company name, language |
| **Auth** | Bearer, role `EMPLOYER` |

**Success (`200`):**

```json
{
  "id": "user-uuid",
  "firstName": "Acme",
  "lastName": "HR",
  "email": "hr@acme.cm",
  "phone": "+237650000000",
  "avatar": "https://cdn.../logo.png",
  "languagePreference": "EN",
  "company": {
    "id": "employer-profile-uuid",
    "name": "Acme Services",
    "logo": "https://cdn.../logo.png"
  },
  "roles": "employer"
}
```

---

### 5.2 `GET /api/employer/dashboard`

| | |
|---|---|
| **Purpose** | Dashboard stat cards + live jobs with applicant counts |
| **Auth** | Bearer |

**Success (`200`):**

```json
{
  "activeJobs": { "count": 3, "label": "currently live" },
  "totalApplicants": { "count": 24, "trend": "all time" },
  "hiredWorkers": { "count": 5, "trend": "hired via applications" },
  "totalPayroll": { "count": "1.2M", "trend": "completed payments (XAF)" },
  "liveJobs": [
    {
      "jobId": "uuid",
      "title": "Frontend Developer",
      "location": "Douala, Bonanjo",
      "jobType": "Full Time",
      "salary": "185,000 XAF/month",
      "status": "live",
      "applicantsCount": 7,
      "shortlistedCount": 2,
      "postedAt": "2026-05-20T10:00:00.000Z"
    }
  ]
}
```

**Frontend:** Use `GET /api/employer/applicants?limit=3&sort=recent` for a richer applicants preview if needed.

---

## 6. Jobs

### 6.1 `POST /api/employer/jobs`

| | |
|---|---|
| **Purpose** | Create and submit job for admin review, or save as draft |
| **Auth** | Bearer |
| **Status** | `201 Created` |

**Body (required fields marked):**

```json
{
  "title": "Frontend Developer",
  "city": "Douala",
  "neighbourhood": "Bonanjo",
  "description": "Long description (min 10 chars)...",
  "requiredSkills": ["React", "TypeScript"],
  "requiredLevel": "Senior",
  "employmentType": "Full Time",
  "durationValue": 9,
  "durationUnit": "Months",
  "pay": 185000,
  "currency": "XAF",
  "per": "Month",
  "numberOfOpenings": 2,
  "startDate": "2026-06-01",
  "startAsap": false,
  "requirements": ["University degree"],
  "responsibilities": ["Build UI"],
  "asDraft": false
}
```

| Field | Notes |
|-------|--------|
| `asDraft` | `true` → status `draft`, no admin review yet |
| `employmentType` | Display string e.g. `"Full Time"` or enum-style |
| `per` | `Month`, `Day`, `Hour`, etc. |

**Success (`201`):**

```json
{
  "jobId": "uuid",
  "status": "pending_review",
  "message": "Job submitted. Joballa admin will review before going live."
}
```

Draft: `"status": "draft"`, `"message": "Job saved as draft."`

**Processing:** Job is created under the authenticated employer’s profile. Non-draft jobs get `UNDER_REVIEW` until admin approves (`live`).

---

### 6.2 `GET /api/employer/jobs`

| | |
|---|---|
| **Query** | `status` (see [§12](#12-status-reference)), `page`, `limit` |
| **Auth** | Bearer |

**Success (`200`):** `{ items, total, page, limit }` — each item matches dashboard `liveJobs` shape.

---

### 6.3 `GET /api/employer/jobs/:jobId`

Full job preview for edit/detail screens: list fields plus `company`, `pay`, `description`, `requirements`, `responsibilities`, `city`, `neighbourhood`, etc.

**Errors:** `404` if job not found or not owned by employer.

---

### 6.4 `PATCH /api/employer/jobs/:jobId`

Partial update with same field names as create (all optional in `UpdateEmployerJobDto`).

**Success (`200`):** Job detail object.

---

### 6.5 `PATCH /api/employer/jobs/:jobId/status`

**Body:**

```json
{ "status": "live" }
```

| API status | Meaning |
|------------|---------|
| `draft` | Draft only |
| `pending_review` | Awaiting admin |
| `live` | Active posting |
| `paused` | Paused |
| `closed` | Closed |

**Errors:** `400` e.g. invalid transition, job already closed.

---

### 6.6 `POST /api/employer/jobs/:jobId/draft`

Save partial form as draft. Body: subset of job fields (e.g. `{ "city": "Douala", "neighbourhood": "Akwa" }`).

**Success (`200`):** Job detail with `"status": "draft"`.

---

### 6.7 `DELETE /api/employer/jobs/:jobId`

**Success:** `204 No Content`

**Errors:** `400` `"Job is already closed."` — delete **draft** jobs before closing, or only delete non-closed jobs.

---

## 7. Applicants

### 7.1 `GET /api/employer/applicants/filters`

**Success (`200`):**

```json
{
  "jobTitles": [{ "jobId": "uuid", "title": "Frontend Developer" }],
  "statuses": ["pending", "shortlisted", "rejected", "hired"]
}
```

---

### 7.2 `GET /api/employer/applicants`

| | |
|---|---|
| **Query** | `search`, `jobId`, `status`, `sort`, `page`, `limit`, `view` (`list` \| `grid`) |

**Success (`200`):** Paginated `items` with applicant summary per row (name, job, status, dates — see live API for exact fields).

Example query:

```http
GET /api/employer/applicants?search=designer&jobId=uuid&status=pending&sort=most_relevant&page=1&limit=12
```

---

### 7.3 `GET /api/employer/applicants/:applicationId`

Returns application id, job info, status, and **`submittedProfile`** snapshot (JSON captured at apply time).

**Errors:** `404` not found or wrong employer.

---

### 7.4 `PATCH /api/employer/applicants/:applicationId/status`

**Body:**

```json
{ "status": "shortlisted" }
```

Allowed: `pending`, `shortlisted`, `rejected`, `hired`.

**Processing:**

- Updates application status
- **`hired`** creates a `WorkEngagement` if none exists (worker appears under workforce)

**Success (`200`):** Updated applicant summary including `status`.

---

### 7.5 `PATCH /api/employer/applicants/:applicationId/notes`

| | |
|---|---|
| **Purpose** | Persist private employer notes on an application (`applications.employerNotes`) |
| **Auth** | Bearer |

**Body:**

```json
{
  "employerNotes": "Strong candidate — schedule interview."
}
```

**Success (`200`):**

```json
{
  "applicationId": "uuid",
  "employerNotes": "Strong candidate — schedule interview."
}
```

Detail `GET .../applicants/:applicationId` also returns `employerNotes` when set. `matchPercent` comes from DB when present, otherwise defaults to `70`.

---

### 7.6 `GET /api/employer/applicants/:applicationId/share`

**Success (`200`):**

```json
{
  "shareUrl": "https://joballa.cm/share/applications/uuid"
}
```

(Exact URL pattern may vary by environment.)

---

## 8. Workforce & shifts

`:workerId` is **`WorkerProfile.id`** (not `User.id`).

### 8.1 `GET /api/employer/workforce`

| | |
|---|---|
| **Query** | `status` (`all` \| `active` \| `terminated`), `page`, `limit` |

**Success (`200`):** Stats object + paginated `items` (worker name, role, status, engagement dates).

---

### 8.2 `GET /api/employer/workforce/:workerId`

Worker profile + engagement details for the worker detail page.

---

### 8.3 `GET /api/employer/workforce/:workerId/shifts`

| | |
|---|---|
| **Query** | `page`, `limit` (default limit 50) |

Paginated shift rows: date, hours, notes, loggedBy, etc.

---

### 8.4 `POST /api/employer/workforce/:workerId/shifts`

| | |
|---|---|
| **Status** | `201 Created` |

**Body:**

```json
{
  "date": "2026-05-22",
  "hours": 8,
  "notes": "Optional shift notes"
}
```

---

### 8.5 `PATCH /api/employer/workforce/:workerId/shifts/:shiftId`

Update `date`, `hours`, and/or `notes`.

---

### 8.6 `DELETE /api/employer/workforce/:workerId/shifts/:shiftId`

**Success:** `204 No Content`

---

### 8.7 `PATCH /api/employer/workforce/:workerId/status`

**Body:**

```json
{
  "status": "terminated",
  "reason": "End of contract"
}
```

Use `active` / reinstate values per `UpdateWorkforceStatusDto` (see backend for allowed strings).

---

## 9. Payments

### 9.1 `GET /api/employer/payments`

| | |
|---|---|
| **Query** | `month` (1–12), `year` (e.g. 2026) |

**Success (`200`):** Payroll stat cards e.g. `totalPayroll`, `pendingPayroll`, `paidThisMonth` (field names on `totalPayroll` object in response).

---

### 9.2 `GET /api/employer/payments/workers`

Same `month` / `year` query. Returns pay table rows per hired worker (amount due, paid status, worker name, etc.).

---

### 9.3 `POST /api/employer/payments/pay`

| | |
|---|---|
| **Status** | `201 Created` |

**Body:**

```json
{
  "workerId": "worker-profile-uuid",
  "amount": 50000,
  "currency": "XAF",
  "provider": "MoMo",
  "phone": "+237650000001",
  "period": "2026-05"
}
```

| Field | Notes |
|-------|--------|
| `provider` | `MoMo` or `OM` (Orange Money) |
| `period` | `YYYY-MM` pay period |
| `workerId` | `WorkerProfile.id` |

**Success (`201`):**

```json
{
  "paymentId": "uuid",
  "status": "pending",
  "message": "Payment initiated."
}
```

Payments stay **`PENDING`** until mobile money integration confirms.

---

### 9.4 `GET /api/employer/payments/history`

| | |
|---|---|
| **Query** | `search`, `page`, `limit` |

Paginated past payments.

---

### 9.5 `GET /api/employer/payments/:paymentId`

Single payment / invoice detail.

---

### 9.6 `GET /api/employer/payments/statement`

| | |
|---|---|
| **Query** | `from`, `to` (ISO date strings) |

Payroll statement payload for export/PDF (aggregated rows for the period).

---

## 10. Company profile

### 10.1 `GET /api/employer/company`

**Success (`200`)** includes:

| Field | Notes |
|-------|--------|
| `companyId` | Employer profile UUID |
| `name` | Company name |
| `tagline` | Short tagline (nullable) |
| `logo`, `industry`, `size`, `bio` | Profile fields |
| `location` | `{ city, country }` or null |
| `website`, `email` | Contact |
| `verificationStatus` | e.g. `VERIFIED`, `PENDING` |
| `applicantsCount` | All applications on employer jobs |
| `employeesCount` | Active `work_engagements` count |

---

### 10.2 `PATCH /api/employer/company`

**Body (all optional):**

```json
{
  "name": "Acme Services",
  "tagline": "Reliable teams across Cameroon",
  "industry": "Technology",
  "size": "11-50",
  "bio": "About the company",
  "location": { "city": "Douala", "country": "Cameroon" },
  "website": "https://acme.cm",
  "logo": "https://existing-cdn-url/logo.png"
}
```

**Success (`200`):** Updated company object (same shape as GET).

---

### 10.3 `POST /api/employer/company/logo`

| | |
|---|---|
| **Content-Type** | `multipart/form-data` |
| **Field name** | `logo` (image file) |
| **Status** | `201 Created` |

**Constraints:** Image MIME types only; max size per `MAX_FILE_SIZES.EMPLOYER_LOGO` (see `files.constants.ts`).

**Processing:** Uploads to Cloudinary (requires `CLOUDINARY_*` on server). Updates `logoUrl` on employer profile.

**Success (`201`):** Returns company/profile with new logo URL.

**Local testing:** Set `SKIP_LOGO_UPLOAD=1` in smoke scripts to skip if Cloudinary is not configured.

---

## 11. Notifications & applicant notes

### 11.1 `GET /api/employer/notifications`

| | |
|---|---|
| **Query** | `filter` (`all` \| `applicants` \| `payments`), `page`, `limit` |
| **Auth** | Bearer |

**Success (`200`):** `{ items, total, page, limit }` — each item: `id`, `type`, `title`, `body`, `read`, `createdAt`, `deepLink` (from notification metadata when set).

Rows are stored in `notifications` with channel `IN_APP` for the employer user.

---

### 11.2 `PATCH /api/employer/notifications/:id/read`

**Success (`200`):** Updated notification object.

**Errors:** `404` if not found or not owned by user.

---

### 11.3 `PATCH /api/employer/settings/notifications`

**Body (all optional):**

```json
{
  "pushEnabled": true,
  "emailEnabled": true,
  "applicantsEnabled": true,
  "messagesEnabled": false
}
```

**Success (`200`):** Merged settings object.

**Note:** Preferences are held **in memory per server instance** until a DB table is added; safe for UI toggles in dev, not durable across deploys.

---

### Not built yet (employer)

| Route | Purpose |
|-------|---------|
| `POST /api/employer/company/verification-doc` | Business registration upload |
| `GET /api/employer/company/verification-status` | Dedicated verification poll (use `verificationStatus` on company GET for now) |
| `GET /api/employer/notifications/unread-count` | Optional badge helper (derive from list or add later) |

---

## 12. Status reference

### Job statuses (employer API)

| Value | UI label suggestion |
|-------|---------------------|
| `draft` | Draft |
| `pending_review` | Under review |
| `live` | Live |
| `paused` | Paused |
| `closed` | Closed |
| `rejected` | Rejected by admin |

### Applicant statuses

`pending`, `shortlisted`, `rejected`, `hired`

### Payment status (after pay)

Typically `pending` → `completed` / `failed` when provider webhook exists.

---

## 13. Smoke tests, e2e & env vars

**In-process e2e (recommended after backend changes):**

```bash
npm run test:e2e -- --testPathPatterns=employer-may-2026
```

Creates a temporary employer when `JOBALLA_EMPLOYER_IDENTIFIER` / `JOBALLA_EMPLOYER_PASSWORD` are unset (uses `DATABASE_URL` from `.env`).

Production default for HTTP smokes: **`https://joballa-api.onrender.com`**

```bash
npm run smoke:employer
```

| Variable | Purpose |
|----------|---------|
| `JOBALLA_EMPLOYER_USE_LOCAL=1` | Target `http://127.0.0.1:$PORT` instead of Render |
| `JOBALLA_EMPLOYER_IDENTIFIER` + `JOBALLA_EMPLOYER_PASSWORD` | Login as existing employer |
| `JOBALLA_EMPLOYER_TOKEN` | Reuse JWT |
| `JOBALLA_EMPLOYER_BOOTSTRAP=1` | Seed test employer via Prisma + API (needs `DATABASE_URL` / `DIRECT_DB_URL` same as prod DB) |
| `JOBALLA_DEV_FIXED_OTP` | Six digits — local register bootstrap only (must match server) |
| `SKIP_LOGO_UPLOAD=1` | Skip logo upload test |

Per-script runs: `npm run smoke:employer:jobs`, etc.

---

## 14. Document history

| Date | Change |
|------|--------|
| May 31, 2026 | 34 routes: notifications, notification settings, applicant notes PATCH; company `tagline` + `applicantsCount` / `employeesCount`; worker migration table; e2e `employer-may-2026`. |
| May 23, 2026 | Initial guide: all 30 employer routes, production smoke verification, auth & error patterns. |
