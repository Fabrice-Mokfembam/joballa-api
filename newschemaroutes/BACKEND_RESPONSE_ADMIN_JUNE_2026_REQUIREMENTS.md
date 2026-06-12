# Backend Response: Admin UI Requirements (June 2026)

**Date:** 2026-06-09  
**To:** Joballa admin frontend + backend teams  
**Status:** Implemented on `development` (commit `380b7d5`)  
**Migration:** `20260607120000_admin_ui_requirements_june_2026`  
**Baseline assumed shipped:** June 2026 admin route doc (auth, KYC, jobs moderation, finance, etc.)

This document is the **implementation response** to the *Joballa Admin — Backend Requirements* spec (14 checklist items). It uses the same contract format as [FRONTEND_ADMIN_ROUTES.md](./FRONTEND_ADMIN_ROUTES.md).

---

## How to read this document

Each route section has:

1. **What it does** — server behaviour  
2. **Auth** — Bearer token + permission (if any)  
3. **Sends** — path params, query params, JSON body (exact keys)  
4. **Receives** — success JSON shape (exact keys under `data`)  
5. **Errors** — common validation failures  

**Base path (admin):** `/admin`  
**Production:** `https://joballa-api.onrender.com`  
**Local:** `http://127.0.0.1:8000`

---

## Shared contracts

### Headers (protected routes)

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Success — single object

```ts
type AdminOk<T> = {
  success: true;
  data: T;
};
```

### Success — paginated list

```ts
type AdminPaged<T> = {
  success: true;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    summary?: { jobsWithoutDepartment: number };  // departments list only
  };
};
```

### Error

```ts
type AdminError = {
  success: false;
  error: {
    code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "BAD_REQUEST"
      | "CONFLICT"
      | "ACCOUNT_SUSPENDED";
    message: string;
  };
};
```

HTTP status matches the error (401 / 403 / 404 / 400 / 409).

---

## Database changes (migration)

| Change | Detail |
| --- | --- |
| `applications.source` | Enum `application_source`: `web`, `mobile_app`. **Nullable** — null counts as `web` in analytics |
| `jobs.department_id` | **Nullable** — jobs may have no department |
| `dispute_status` | `in_review` migrated to `open`; enum is now `open`, `resolved`, `closed` only |

```bash
npx prisma migrate deploy
npx prisma generate
```

---

## Worker route — application source (feeds admin analytics)

### POST `/worker/jobs/:jobId/apply`

**What it does:** Worker applies to a job. Optional `source` is stored on the application row for dashboard analytics.

**Auth:** Bearer (worker)

**Sends:**

```ts
// Path: jobId
{
  source?: "web" | "mobile_app" | "mobile";  // mobile → mobile_app
  coverNote?: string;
  attachedDocuments?: object[];
}
```

**Storage rules:**

| Sent value | DB `applications.source` | Analytics bucket |
| --- | --- | --- |
| omitted / `web` | `null` | `web` |
| `mobile_app` or `mobile` | `mobile_app` | `mobile_app` |

**Receives:** Existing worker application detail shape (unchanged).

**Errors:** Unchanged (404 job, 403 incomplete profile, etc.).

---

## Authentication — suspended accounts

### POST `/admin/auth/login`

**What it does:** Admin login. Suspended admin accounts are rejected before token issue.

**Auth:** Public

**Sends:** `{ identifier: string; password: string; }` (or `email` alias)

**Receives:** `AdminOk<{ accessToken; refreshToken; session }>` on success.

**Errors:**

- `401 UNAUTHORIZED` — invalid credentials  
- `403 ACCOUNT_SUSPENDED`:

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_SUSPENDED",
    "message": "Account suspended. Contact support."
  }
}
```

---

### POST `/admin/auth/refresh`

**What it does:** Rotates admin refresh token. Suspended admins cannot refresh.

**Auth:** Public (refresh cookie or body `refreshToken`)

**Errors:**

- `401 UNAUTHORIZED` — invalid/missing refresh token  
- `403 ACCOUNT_SUSPENDED` — same shape as login

---

### POST `/auth/login` / POST `/auth/refresh` (platform users)

**What it does:** Worker/employer auth. Suspended platform users get the same `ACCOUNT_SUSPENDED` shape (403).

**Auth:** Public

---

### Any Bearer-protected route

**What it does:** If account became suspended after token was issued, guard rejects the request.

**Admin routes:** `AdminJwtGuard` → `403 ACCOUNT_SUSPENDED`  
**Worker/employer routes:** `JwtAuthGuard` → `403 ACCOUNT_SUSPENDED`

---

## Dashboard (read access — all authenticated admins)

> **June 2026 change:** `GET /admin/dashboard` and `GET /admin/dashboard/analytics` require **only a valid admin Bearer token**. No `view_platform_analytics` or other permission. Every admin sees the **same full stats** as super admin.

### GET `/admin/dashboard`

**What it does:** Returns **all** summary counter blocks plus `session`. Blocks are never omitted by permission.

**Auth:** Bearer + any active admin session

**Sends:** No query/body.

**Receives:**

```ts
type AdminDashboard = AdminOk<{
  session: AdminSession;
  jobs: {
    totalJobs: number;        // ALL jobs — use for unassigned: totalJobs − Σ dept.jobs
    pendingJobs: number;
    approvedJobs: number;
    rejectedJobs: number;
    jobsThisMonth: number;
  };
  profiles: {
    totalProfiles: number;
    workers: number;
    employers: number;
    verifiedProfiles: number;
    unverifiedProfiles: number;
  };
  users: { totalUsers: number; activeUsers: number };
  kyc: { pendingKyc: number; verifiedKyc: number; rejectedKyc: number };
  documents: {
    pendingDocuments: number;
    approvedDocuments: number;
    rejectedDocuments: number;
  };
  disputes: {
    totalDisputes: number;
    openDisputes: number;
    resolvedDisputes: number;
    closedDisputes: number;
  };
  finance: {
    totalTransactions: number;
    totalAmountIn: number;
    totalAmountOut: number;
    netBalance: number;
  };
  departments: { totalDepartments: number };  // no active/inactive split
  admins: {
    totalAdmins: number;
    activeAdmins: number;
    pendingInvitations: number;
    inactiveAdmins: number;
  };
}>;
```

**Note:** `jobs.totalJobs` includes jobs with `departmentId: null`. UI “unassigned” = `totalJobs − sum(department job counts)` or use `meta.summary.jobsWithoutDepartment` on department list.

---

### GET `/admin/dashboard/analytics`

**What it does:** Rich analytics for charts. Date dropdown (`range`) filters **`applicationsOverTime`** and **`applicationsBySource`** only (per product spec).

**Auth:** Bearer only — **no** `view_platform_analytics` required

**Sends query:**

```ts
{
  range?: "7d" | "30d" | "90d" | "1y" | `${number}d`;  // default "30d"
  startDate?: string;  // ISO 8601
  endDate?: string;    // ISO 8601, default now
}
```

**Receives:**

```ts
type AdminDashboardAnalytics = AdminOk<{
  range: { start: string; end: string };
  kpis: {
    totalJobs: number;
    jobsCreatedThisMonth: number;
    totalApplications: number;
    applicationsThisMonth: number;
    activeUsers: number;
    activeUsersThisMonth: number;
    kycSubmissions: number;
    kycSubmissionPercentChange: number;
    verifiedUsers: number;
    verifiedUsersThisMonth: number;
  };
  applicationsOverTime: Array<{ date: string; applications: number }>;  // YYYY-MM-DD, filtered by range
  jobsByStatus: { active: number; draft: number; paused: number; closed: number };
  documentsByStatus: {
    approved: number;
    pending: number;    // includes pending + pending_review + not_submitted in DB
    rejected: number;
  };
  kycFunnel: { submitted: number; underReview: number; verified: number; rejected: number };
  applicationsBySource: Array<{ source: "web" | "mobile_app"; applications: number }>;  // filtered by range
  topDepartments: Array<{
    departmentId: string;
    departmentName: string;
    jobs: number;
    applications: number;
    hires: number;
    conversionRate: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;  // human-readable audit details
    createdAt: string;
  }>;
}>;
```

**`applicationsBySource` example:**

```json
[
  { "source": "web", "applications": 1842 },
  { "source": "mobile_app", "applications": 1234 }
]
```

Null/missing `applications.source` counts toward `web`.

---

### GET `/admin/dashboard/export`

**What it does:** CSV download from analytics data.

**Auth:** Bearer + `view_platform_analytics` (export still permission-gated)

**Sends query:** Same as analytics + `format=csv`

**Receives:** CSV file (not JSON)

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="joballa-admin-report-YYYY-MM-DD.csv"
```

---

## Platform logs

### GET `/admin/logs`

**What it does:** Paginated audit log. `details` are human-readable (names, not raw UUIDs where possible).

**Auth:** Bearer + `view_platform_logs`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  adminId?: string;   // super_admin and admin_manager only
}
```

**Receives:**

```ts
type AdminLogRow = {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: "super_admin" | "admin_manager" | "verifier" | "support_agent";
  action: string;
  module: string;
  details: string;   // e.g. "Deleted user John Ngu", "KYC approved for Alice Choua"
  ipAddress: string;
  createdAt: string;
};

AdminPaged<AdminLogRow>;
```

**Example `details` strings:**

- `Deleted user John Ngu`
- `KYC approved for Alice Choua`
- `Deleted department Software`
- `Approved job UI/UX Product Designer`

---

## Departments (5 routes — suspend removed)

> Departments are **categories until deleted**. No `isActive`, no suspend/activate routes.

### Shared department object

```ts
type AdminDepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  jobPostsCount: number;
  jobs: number;              // alias of jobPostsCount
  applicationsCount: number;
  applications: number;      // alias
  hiresCount: number;
  hires: number;             // alias
  createdBy: string | null;
  createdAt: string;
};
```

**Removed from API:** `isActive`, `activeJobsCount`, `status` query param.

**Removed routes:**

- ~~`PATCH /admin/departments/:id/suspend`~~
- ~~`PATCH /admin/departments/:id/activate`~~

### Virtual “Other”

- Never create a department named `"Other"` (any case) → `400`
- Jobs without a department: `departmentId: null`, `department: null` on job objects
- `"Other"` is a **frontend-only** label when `department === null`

---

### GET `/admin/departments`

**Auth:** Bearer + `manage_departments`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
}
```

**Receives:**

```ts
AdminPaged<AdminDepartmentRow>;  // meta.summary.jobsWithoutDepartment on list
```

**Example `meta`:**

```json
{
  "page": 1,
  "limit": 10,
  "total": 8,
  "totalPages": 1,
  "summary": { "jobsWithoutDepartment": 42 }
}
```

---

### GET `/admin/departments/:id`

**Receives:** `AdminOk<AdminDepartmentRow>`

---

### POST `/admin/departments`

**Sends:**

```ts
{ name: string; description: string; }
```

**Receives:** `AdminOk<AdminDepartmentRow>`

**Errors:**

- `400 BAD_REQUEST` — `name and description are required.`
- `400 BAD_REQUEST` — `Department name "Other" is reserved.`

---

### PATCH `/admin/departments/:id`

**Sends:**

```ts
{ name?: string; description?: string; }
```

**Receives:** `AdminOk<AdminDepartmentRow>`

**Errors:** `400` if renaming to `"Other"`.

---

### DELETE `/admin/departments/:id`

**Receives:** `AdminOk<{ deleted: true }>`

**Errors:**

- `409 CONFLICT` — `Cannot delete department with active jobs.`
- `404 NOT_FOUND` — department not found

---

## Jobs — nullable department + rejection reason

### Shared job object (updated fields)

```ts
type AdminJobRow = {
  // ...existing fields (title, status, employer, etc.)
  departmentId: string | null;
  department: { id: string; name: string; slug: string } | null;
  rejectionReason: {
    id: string;
    reasonText: string;   // same text sent on PATCH reject { reason }
    rejectedBy: string | null;
    createdAt: string;
  } | null;
  createdAt: string;
};
```

### GET `/admin/jobs` · `/admin/jobs/pending` · `/admin/jobs/rejected`

**Receives:** `AdminPaged<AdminJobRow>` — each row includes `departmentId`, `department`, and `rejectionReason` when applicable.

### PATCH `/admin/jobs/:id/reject`

**Sends:** `{ reason: string; }` — stored and returned as `rejectionReason.reasonText`.

---

## Disputes — reporter / reported

### Shared dispute object (breaking change)

```ts
type AdminDisputeRow = {
  id: string;
  subject: string;
  description: string;
  status: "open" | "resolved" | "closed";  // in_review removed — use open
  priority: "low" | "medium" | "high";
  adminNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  engagementId: string | null;
  engagement: {
    id: string;
    jobTitle: string;
    payRate: number;
    payPeriod: string;
  } | null;
  reporter: {
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    role: "worker" | "employer";
  };
  reported: {
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    role: "worker" | "employer";
  };
  createdAt: string;
};
```

**Removed:** top-level `worker` / `employer` party objects (were hard-coded roles).

**UI:** e.g. `John Ngu (Worker)` from `reporter.fullName` + `reporter.role`.

---

### GET `/admin/disputes`

**Auth:** Bearer + `resolve_disputes`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  status?: "open" | "resolved" | "closed" | "all";  // omit or "all" = no filter
  priority?: "low" | "medium" | "high";
  departmentId?: string;
}
```

**Notes:**

- `in_review` filter value is accepted and treated as `open` (legacy).
- API never returns `in_review` as status.

**Receives:** `AdminPaged<AdminDisputeRow>`

---

### GET `/admin/disputes/:id`

**Receives:** `AdminOk<AdminDisputeRow>`

---

## Profiles — Mine filter

### GET `/admin/profiles`

**Auth:** Bearer + `create_profiles`

**Sends query (added / clarified):**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  role?: "worker" | "employer";
  profileType?: "worker" | "employer";
  isAdminCreated?: "true";
  createdByAdmin?: string;   // admin UUID — powers "Mine" filter
}
```

**Visibility + filter rules:**

| Caller | Default list scope | `createdByAdmin` |
| --- | --- | --- |
| `super_admin` | All admin-created profiles | Any admin id |
| Other admins with `create_profiles` | Only profiles they created | **Only their own** admin id |

**Errors:** `403 FORBIDDEN` — `You can only filter profiles you created.` when non–super-admin passes another admin's id.

**Receives:** `AdminPaged<AdminProfileRow>` (unchanged row shape).

---

## Requirements checklist (all done)

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Applications `source`; `web` default; analytics by source | Done |
| 2 | `range` filters `applicationsOverTime` + `applicationsBySource` | Done |
| 3 | Remove department suspend routes / API status | Done |
| 4 | Department list: jobs / applications / hires counts | Done |
| 5 | No `"Other"` department; jobs may have `departmentId: null` | Done |
| 6 | `dashboard.jobs.totalJobs` for unassigned job count | Done |
| 7 | Job `rejectionReason` on list/detail | Done |
| 8 | Block login + refresh for suspended users/admins | Done |
| 9 | Audit logs: human-readable `details`; `adminRole` on rows | Done |
| 10 | Disputes: `reporter` + `reported` with `role` | Done |
| 11 | Merge `in_review` → `open` | Done (migration + API) |
| 12 | Profiles: `createdByAdmin` query param | Done |
| 13 | Analytics: pending documents include pending_review | Done |
| 14 | Dashboard + analytics readable by all admins | Done |

---

## Implementation map

| Area | Files |
| --- | --- |
| Schema / migration | `prisma/schema.prisma`, `prisma/migrations/20260607120000_admin_ui_requirements_june_2026/` |
| Admin | `admin-v2.service.ts`, `admin-v2.controller.ts`, `admin-mappers.ts`, `admin-api-format.ts`, `admin-auth.service.ts`, `guards/admin-jwt.guard.ts` |
| Worker apply | `worker-v2.service.ts` |
| Platform auth | `auth.service.ts`, `jwt-auth.guard.ts`, `src/common/errors/account-suspended.error.ts` |

---

## Route count

**62** admin routes (removed department suspend + activate from prior 64).

---

## Related docs

| Document | Purpose |
| --- | --- |
| [FRONTEND_ADMIN_ROUTES.md](./FRONTEND_ADMIN_ROUTES.md) | Full admin API reference (updated for June 2026) |
| [BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md](./BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md) | May 2026 delta only |
