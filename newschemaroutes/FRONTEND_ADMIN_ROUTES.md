# Frontend Admin Panel API (v2)

This document is for the **admin portal frontend team**. Every route below lists **exact JSON property names** for requests and responses so you do not send or read the wrong fields.

**Base path:** `/admin` (no `/api` prefix)  
**Production:** `https://joballa-api.onrender.com`  
**Local:** `http://127.0.0.1:8000`  
**Verified:** 58/58 smoke tests passed on production (June 2026).  
**June 2026 backend response:** [BACKEND_RESPONSE_ADMIN_JUNE_2026_REQUIREMENTS.md](./BACKEND_RESPONSE_ADMIN_JUNE_2026_REQUIREMENTS.md) (dashboard read access, application source, departments, disputes, suspended auth).  
**May 2026 delta:** [BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md](./BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md).

Related: [VERIFIED_API_INTEGRATION.md](./VERIFIED_API_INTEGRATION.md)

---

## How to read this document

Each route section has:

1. **What it does** — business behaviour on the server  
2. **Auth** — public or Bearer token + permission string  
3. **Sends** — path params, query params, JSON body (exact keys)  
4. **Receives** — success JSON shape (exact keys under `data`)  
5. **Errors** — common validation failures (when relevant)

**Do not guess property names from the database.** Admin JSON uses **camelCase** API names (e.g. `fullName`, `accessToken`, `resolutionNotes`).

---

## Shared contracts

### Headers (all protected routes)

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
    page: number;      // current page (1-based)
    limit: number;     // page size
    total: number;     // total rows matching filters
    totalPages: number;
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

### List query params (most `GET` list routes)

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | number | `1` | 1-based |
| `limit` | number | `10` | max `100` |
| `sort` | string | `createdAt` | field name; varies per route |
| `order` | `"asc"` \| `"desc"` | `"desc"` | |
| `search` | string | — | free text where supported |

### Admin session object (returned on login, `/admin/me`, `/admin/dashboard`)

```ts
type AdminSession = {
  id: string;              // admin UUID
  name: string;            // NOT fullName — API uses name
  email: string;
  role: "super_admin" | "admin_manager" | "verifier" | "support_agent";
  isActive: boolean;
  permissions: string[];
  departments: { id: string; name: string }[];
  lastLoginAt: string | null;  // ISO 8601
};
```

### Permission strings

Use these exact strings in UI gating (also present in JWT / `session.permissions`):

`view_platform_logs` · `view_platform_analytics` · `manage_admins` · `manage_jobs` · `manage_platform_users` · `verify_jobs` · `manage_departments` · `resolve_disputes` · `verify_documents` · `verify_kyc` · `view_financial_records` · `create_profiles`

Super admin always has all permissions server-side.

### Default permissions by role (new admins)

When an admin is created (or role is changed without a custom permission override), the server seeds these defaults:

| Role | Default permissions |
| --- | --- |
| `super_admin` | All permission strings |
| `admin_manager` | All except `manage_admins` is included; full manager set including `create_profiles` |
| `verifier` | `verify_jobs`, `resolve_disputes`, `verify_documents`, `verify_kyc` |
| `support_agent` | `create_profiles` |

`create_profiles` is **not** a verifier default. Grant it explicitly via `/admin/permissions` if a verifier should create profiles.

### Refresh cookie

Cookie name: `adminRefreshToken` (httpOnly). Login and refresh also return `refreshToken` in JSON for non-cookie clients.

---

## Auth routes (3)

### POST `/admin/auth/login`

**What it does:** Authenticates an admin account from `admin_accounts` (not platform `users`). Sets refresh cookie and returns access token + session.

**Auth:** Public (no Bearer token)

**Sends:**

```ts
// Body — use identifier (preferred). email is accepted as alias for identifier.
{
  identifier: string;   // admin email
  password: string;
}

// Alternative accepted by server:
{ email: string; password: string; }
```

**Receives:**

```ts
type AdminLoginResponse = AdminOk<{
  accessToken: string;
  refreshToken: string;
  session: AdminSession;
}>;
```

**Errors:**

- `401 UNAUTHORIZED` — invalid credentials
- `403 ACCOUNT_SUSPENDED` — `{ code: "ACCOUNT_SUSPENDED", message: "Account suspended. Contact support." }`

---

### POST `/admin/auth/refresh`

**What it does:** Rotates refresh token and issues a new access token + session. Old refresh token is invalidated.

**Auth:** Public

**Sends (one of):**

```ts
// Body (optional if cookie present)
{ refreshToken?: string; }

// Or httpOnly cookie: adminRefreshToken
```

**Receives:** Same shape as login (`accessToken`, `refreshToken`, `session`).

**Errors:**

- `401 UNAUTHORIZED` — missing, expired, or invalid refresh token
- `403 ACCOUNT_SUSPENDED` — suspended admin account

---

### POST `/admin/auth/logout`

**What it does:** Clears refresh cookie and deletes refresh token row when cookie is present.

**Auth:** Optional (no Bearer required)

**Sends:** Cookie `adminRefreshToken` if available. No body required.

**Receives:**

```ts
AdminOk<{ message: "Logged out" }>;
```

---

## Dashboard & session (5)

### GET `/admin/dashboard`

**What it does:** Returns **all** summary counter blocks plus `session` for every authenticated admin (same stats as super admin). Blocks are never omitted by permission.

**Auth:** Bearer + any valid admin session

**Sends:** No query/body.

**Receives:**

```ts
type AdminDashboard = AdminOk<{
  session: AdminSession;
  jobs?: {
    totalJobs: number;
    pendingJobs: number;
    approvedJobs: number;
    rejectedJobs: number;
    jobsThisMonth: number;
  };
  profiles?: {
    totalProfiles: number;
    workers: number;
    employers: number;
    verifiedProfiles: number;
    unverifiedProfiles: number;
  };
  users?: { totalUsers: number; activeUsers: number };
  kyc?: { pendingKyc: number; verifiedKyc: number; rejectedKyc: number };
  documents?: {
    pendingDocuments: number;
    approvedDocuments: number;
    rejectedDocuments: number;
  };
  disputes?: {
    totalDisputes: number;
    openDisputes: number;
    resolvedDisputes: number;
    closedDisputes: number;
  };
  finance?: {
    totalTransactions: number;
    totalAmountIn: number;
    totalAmountOut: number;
    netBalance: number;
  };
  departments: { totalDepartments: number };
  admins?: {
    totalAdmins: number;
    activeAdmins: number;
    pendingInvitations: number;
    inactiveAdmins: number;
  };
}>;
```

**Note:** `jobs.totalJobs` counts **all** jobs including `departmentId: null`. UI unassigned count: `totalJobs − sum(department jobs)` or `meta.summary.jobsWithoutDepartment` on department list. Rich charts use `GET /admin/dashboard/analytics`. No admin route to post jobs — link to employer portal or remove dashboard action.

---

### GET `/admin/dashboard/analytics`

**What it does:** Returns richer dashboard analytics (KPIs, time series, funnel, top departments, recent activity) for chart widgets.

**Auth:** Bearer only — **no** `view_platform_analytics` required (June 2026)

**Sends query:**

```ts
{
  range?: "7d" | "30d" | "90d" | "1y" | `${number}d`;  // default 30d — filters applicationsOverTime + applicationsBySource
  startDate?: string;
  endDate?: string;
}
```

**Receives:**

```ts
type AdminDashboardAnalytics = AdminOk<{
  range: { start: string; end: string };
  kpis: { /* unchanged — see BACKEND_RESPONSE_ADMIN_JUNE_2026_REQUIREMENTS.md */ };
  applicationsOverTime: Array<{ date: string; applications: number }>;
  jobsByStatus: { active: number; draft: number; paused: number; closed: number };
  documentsByStatus: { approved: number; pending: number; rejected: number };  // pending includes pending_review
  kycFunnel: { submitted: number; underReview: number; verified: number; rejected: number };
  applicationsBySource: Array<{ source: "web" | "mobile_app"; applications: number }>;
  topDepartments: Array<{ departmentId: string; departmentName: string; jobs: number; applications: number; hires: number; conversionRate: number }>;
  recentActivity: Array<{ id: string; type: string; description: string; createdAt: string }>;
}>;
```

`applicationsBySource` always returns `web` and `mobile_app` buckets. Null DB `source` counts as `web`. Workers send `source` on `POST /worker/jobs/:jobId/apply`.

---

### GET `/admin/dashboard/export`

**What it does:** Downloads a CSV report built from the same analytics data as `/admin/dashboard/analytics`.

**Auth:** Bearer + `view_platform_analytics`

**Sends query:** Same as analytics, plus `format=csv` (only supported value).

**Receives:** Raw CSV file (not JSON). Response headers:

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="joballa-admin-report-YYYY-MM-DD.csv"
```

---

### GET `/admin/me`

**What it does:** Returns current admin session (same object as login `session`).

**Auth:** Bearer

**Sends:** Nothing.

**Receives:**

```ts
AdminOk<{ session: AdminSession }>;
```

---

### PATCH `/admin/me`

**What it does:** Updates the logged-in admin's display name and/or password.

**Auth:** Bearer

**Sends:**

```ts
{
  name?: string;              // maps to server fullName — send name, NOT fullName
  currentPassword?: string;   // required when newPassword is sent
  newPassword?: string;       // min 8 characters
}
```

**Receives:**

```ts
AdminOk<{ session: AdminSession }>;
```

**Errors:**

- `400 BAD_REQUEST` — `currentPassword is required to change password.`
- `400 BAD_REQUEST` — `Current password is incorrect.`
- `400 BAD_REQUEST` — `New password must be at least 8 characters.`

---

## Platform logs (1)

### GET `/admin/logs`

**What it does:** Paginated audit log from `admin_audit_logs`. Super admin sees all logs; admin manager sees non–super-admin logs; others see only their own.

**Auth:** Bearer + `view_platform_logs`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  sort?: string;       // default createdAt
  order?: "asc" | "desc";
  search?: string;     // matches details, action, module, admin name/email
  module?: string;
  action?: string;
  startDate?: string;  // ISO date parsed by server
  endDate?: string;
  adminId?: string;    // super_admin and admin_manager only
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
  details: string;   // human-readable, e.g. "Deleted Software department"
  ipAddress: string;   // empty string if unknown
  createdAt: string;   // ISO 8601
};

AdminPaged<AdminLogRow>;
```

---

## KYC (5)

### Shared KYC object

```ts
type AdminKycRow = {
  id: string;
  status: "pending" | "verified" | "rejected";
  kycType: "national_id" | "passport" | "drivers_license";  // lowercase
  frontUrl: string;
  backUrl: string | null;
  selfieUrl: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;       // admin UUID
  rejectionReason: string | null;
  worker: {
    id: string;
    email: string | null;
    phone: string | null;
    fullName: string;
    photoUrl: string | null;
    city: string | null;
    region: string | null;
    isVerified: boolean;
  };
};
```

### GET `/admin/kyc`

**What it does:** Lists worker KYC submissions for review.

**Auth:** Bearer + `verify_kyc`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  sort?: string;       // default createdAt; workerName falls back to createdAt
  order?: "asc" | "desc";
  search?: string;     // worker email, phone, fullName
  status?: "pending" | "verified" | "rejected";
  idType?: string;     // e.g. NATIONAL_ID — server uppercases
}
```

**Receives:** `AdminPaged<AdminKycRow>`

---

### GET `/admin/kyc/:id`

**What it does:** Single KYC submission detail.

**Auth:** Bearer + `verify_kyc`

**Sends:** Path `id` — KYC submission UUID.

**Receives:** `AdminOk<AdminKycRow>`

**Errors:** `404 NOT_FOUND` — `KYC submission not found.`

---

### PATCH `/admin/kyc/:id/approve`

**What it does:** Marks KYC verified and sets worker profile `verificationStatus` to verified.

**Auth:** Bearer + `verify_kyc`

**Sends:** Path `id` only. **No body.**

**Receives:** `AdminOk<AdminKycRow>` (updated row)

---

### PATCH `/admin/kyc/:id/reject`

**What it does:** Rejects KYC and stores rejection reason.

**Auth:** Bearer + `verify_kyc`

**Sends:**

```ts
// Path: id
// Body — required
{ reason: string; }   // NOT rejectionReason
```

**Receives:** `AdminOk<AdminKycRow>`

**Errors:** `400 BAD_REQUEST` — `reason is required.`

---

### PATCH `/admin/kyc/:id/status`

**What it does:** Unified KYC status transitions. Use this when moving a submission **back to pending**; use `approve` / `reject` for verified/rejected transitions from the UI if you prefer.

| Target `status` | Behaviour |
| --- | --- |
| `pending` | Clears verification/rejection fields; sets worker profile to pending |
| `verified` | Same as `PATCH .../approve` |
| `rejected` | Same as `PATCH .../reject` (`reason` required) |

**Auth:** Bearer + `verify_kyc`

**Sends:**

```ts
{
  status: "pending" | "verified" | "rejected";
  reason?: string;   // required when status is rejected
}
```

**Receives:** `AdminOk<AdminKycRow>`

---

## Employer documents (4)

### Shared document object

```ts
type AdminDocumentRow = {
  id: string;
  documentName: string;
  documentUrl: string;
  documentType: "pdf" | "image";   // lowercase
  verificationStatus: "pending_review" | "approved" | "rejected" | "resubmitted";
  verificationNotes: string | null;
  rejectionReason: string | null;  // populated when rejected
  submittedAt: string;
  reviewer: {
    id: string;
    name: string;
    email: string;
  } | null;
  submitter: {
    id: string;
    email: string | null;
    phone: string | null;
    role: "worker" | "employer";
    fullName: string;
    photoUrl: string | null;
  };
};
```

### GET `/admin/documents`

**Auth:** Bearer + `verify_documents`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  status?: "pending_review" | "approved" | "rejected" | "resubmitted";
  reviewerId?: string;
}
```

**Receives:** `AdminPaged<AdminDocumentRow>`

---

### GET `/admin/documents/:id`

**Auth:** Bearer + `verify_documents`

**Sends:** Path `id`

**Receives:** `AdminOk<AdminDocumentRow>`

---

### PATCH `/admin/documents/:id/approve`

**What it does:** Approves document and sets reviewer to current admin.

**Sends:** Path `id` only. No body.

**Receives:** `AdminOk<AdminDocumentRow>`

---

### PATCH `/admin/documents/:id/reject`

**Sends:**

```ts
{ reason: string; }   // required — stored as verificationNotes
```

**Receives:** `AdminOk<AdminDocumentRow>`

**Errors:** `400 BAD_REQUEST` — `reason is required.`

---

## Jobs (6)

There is **no** `GET /admin/jobs/:id`. List items are full job objects — use them for detail panels.

### Shared job object

```ts
type AdminJobRow = {
  id: string;
  title: string;
  status: "live" | "draft" | "pending" | "closed" | "paused" | "rejected";
  employmentType: "full_time" | "part_time" | "contract" | "casual" | "seasonal" | "internship";
  jobType: "onsite" | "remote" | "hybrid";   // work mode — API name is jobType
  country: string;
  city: string;
  neighbourhood: string | null;
  payAmount: number;
  experienceLevel: string | null;   // lowercase enum or null
  startDate: string | null;
  startNow: boolean;
  duration: string | null;
  description: string;
  requirements: string[];
  responsibilities: string[];
  requiredSkills: string[];
  adminNotes: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  paymentManagedByJoballa: boolean;
  departmentId: string | null;
  department: { id: string; name: string; slug: string } | null;  // null = unassigned (UI may label "Other")
  employer: {
    id: string;           // employer profile id when present, else owner user id
    userId: string;
    companyName: string;
    companyLogoUrl: string | null;
    city: string | null;
    country: string | null;
  };
  rejectionReason: {
    id: string;
    reasonText: string;
    rejectedBy: string | null;
    createdAt: string;
  } | null;
  submissionScore: {
    score: number;
    tier: string;
    scoreBreakdown: unknown;
  } | null;
  createdAt: string;
};
```

**Status mapping (send on filters / PATCH status):**

| API value | Meaning |
| --- | --- |
| `live` | Active published job |
| `pending` | Under admin review |
| `draft` | Draft |
| `paused` | Paused |
| `closed` | Closed |
| `rejected` | Rejected |

---

### GET `/admin/jobs`

**Auth:** Bearer + `manage_jobs`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  sort?: "createdAt" | "title" | "payAmount";
  order?: "asc" | "desc";
  search?: string;
  status?: "live" | "draft" | "pending" | "closed" | "paused" | "rejected";
  departmentId?: string;
  employmentType?: string;   // FULL_TIME etc. — server uppercases
  jobType?: string;          // maps to workMode: ONSITE, REMOTE, HYBRID
  experienceLevel?: string;
}
```

**Receives:** `AdminPaged<AdminJobRow>`

Department scoping applies for verifiers with department assignments.

---

### GET `/admin/jobs/pending`

**What it does:** Same as list jobs but fixed to `status = pending` (under review queue).

**Auth:** Bearer + `verify_jobs`

**Sends:** Same query as `GET /admin/jobs` (except status filter is overridden server-side).

**Receives:** `AdminPaged<AdminJobRow>`

---

### GET `/admin/jobs/rejected`

**Auth:** Bearer + `manage_jobs`

**Receives:** `AdminPaged<AdminJobRow>` with rejected jobs only.

---

### PATCH `/admin/jobs/:id/approve`

**What it does:** Moves job from under review to live (`pending` → `live`).

**Auth:** Bearer + `verify_jobs`

**Sends:** Path `id` only.

**Receives:** `AdminOk<AdminJobRow>`

**Errors:**

- `404 NOT_FOUND` — job not found
- `400 BAD_REQUEST` — `Job is not pending review.`

---

### PATCH `/admin/jobs/:id/reject`

**Sends:**

```ts
{ reason: string; }   // required
```

**Receives:** `AdminOk<AdminJobRow>`

---

### PATCH `/admin/jobs/:id/status`

**What it does:** Sets job status (except approving rejected→live — use approve route).

**Auth:** Bearer + `manage_jobs`

**Sends:**

```ts
{
  status: "live" | "draft" | "pending" | "closed" | "paused" | "rejected";
}
```

**Receives:** `AdminOk<AdminJobRow>`

**Errors:** `400 BAD_REQUEST` — `Use /approve for rejected→live transitions.` when sending `live` via this route incorrectly.

---

## Departments (5)

Departments are categories until deleted. **No suspend/activate** — `isActive` and `status` filters removed (June 2026).

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
  createdBy: string | null;   // admin UUID
  createdAt: string;
};
```

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

**Receives:** `AdminPaged<AdminDepartmentRow>` — optional `meta.summary.jobsWithoutDepartment` for unassigned job count.

---

### GET `/admin/departments/:id`

**Receives:** `AdminOk<AdminDepartmentRow>`

---

### POST `/admin/departments`

**What it does:** Creates department (server sets category internally; slug auto-generated).

**Sends:**

```ts
{
  name: string;         // required
  description: string;  // required
}
// category and jobTypes from older specs are NOT read by server
```

**Receives:** `AdminOk<AdminDepartmentRow>`

**Errors:**

- `400 BAD_REQUEST` — `name and description are required.`
- `400 BAD_REQUEST` — `Department name "Other" is reserved.` (never store "Other" in DB)

---

### PATCH `/admin/departments/:id`

**Sends:**

```ts
{
  name?: string;
  description?: string;
}
```

**Receives:** `AdminOk<AdminDepartmentRow>`

**Errors:** `400 BAD_REQUEST` — renaming to `"Other"` is rejected.

---

### DELETE `/admin/departments/:id`

**What it does:** Deletes department if no active jobs exist.

**Receives:**

```ts
AdminOk<{ deleted: true }>;
```

**Errors:**

- `409 CONFLICT` — `Cannot delete department with active jobs.`
- `404 NOT_FOUND` — department not found

---

## Platform users (5)

### Shared user object

```ts
type AdminPlatformUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "worker" | "employer";
  isVerified: boolean;     // derived from profile verification
  isActive: boolean;       // accountStatus === active
  country: string | null;
  city: string | null;
  region: string | null;
  photoUrl: string | null;
  preferredLanguage: "ENG" | "FRE";
  createdByAdmin: string | null;
  createdAt: string;
  profile: object | null;  // workerProfile or employerProfile raw shape
};
```

### GET `/admin/users`

**Auth:** Bearer + `manage_platform_users`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  search?: string;
  role?: "worker" | "employer";
  isActive?: "true" | "false";
  country?: string;
  city?: string;
}
```

**Receives:** `AdminPaged<AdminPlatformUser>`

---

### GET `/admin/users/:id`

**Receives:** `AdminOk<AdminPlatformUser>`

---

### PATCH `/admin/users/:id/suspend`

**What it does:** Sets `accountStatus` to suspended.

**Receives:** `AdminOk<AdminPlatformUser>`

---

### PATCH `/admin/users/:id/activate`

**Receives:** `AdminOk<AdminPlatformUser>`

---

### DELETE `/admin/users/:id`

**Receives:** `AdminOk<{ deleted: true }>`

---

## Admin-created profiles (7)

Profiles are platform users created by admins (`createdByAdminId` set).

**Visibility rules:**

| Caller | Sees |
| --- | --- |
| `super_admin` | All admin-created profiles (`createdByAdminId` set) |
| Any other admin with `create_profiles` (admin manager, support agent, verifier with grant, etc.) | **Only** profiles where `createdByAdminId` equals their own admin id |

Verifiers do **not** have `create_profiles` by default. Admin managers are **not** exempt from the own-profiles-only rule unless they are super admin.

### Shared profile object

```ts
type AdminProfileRow = {
  id: string;              // workerProfile.id or employerProfile.id
  userId: string;
  profileType: "worker" | "employer";
  fullName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: null;          // always null from API today (multipart create not implemented)
  dateOfBirth: string | null;   // YYYY-MM-DD, worker only
  accountStatus: "active" | "suspended";
  city: string | null;
  region: string | null;
  country: string | null;
  isVerified: boolean;
  verificationStatus: string;  // lowercase e.g. verified
  isAdminCreated: boolean;
  createdByAdmin: string | null;
  memberSince: string;
  profileViews?: number;     // worker only
  shortBio?: string | null;
  organization?: string;     // employer only
  role?: string | null;      // worker professionalTitle
  profile: object | null;    // nested workerProfile or employerProfile
};
```

### GET `/admin/profiles`

**Auth:** Bearer + `create_profiles`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  role?: "worker" | "employer";
  profileType?: "worker" | "employer";  // alias for role filter
  isAdminCreated?: "true";
  createdByAdmin?: string;   // admin UUID — powers "Mine" filter
}
```

**Filter rules:** `super_admin` may pass any admin id; other admins with `create_profiles` may only pass **their own** id (`403` otherwise).

**Receives:** `AdminPaged<AdminProfileRow>`

---

### GET `/admin/profiles/:id`

**Sends:** Path `id` — profile id, user id, worker profile id, or employer profile id.

**Receives:** `AdminOk<AdminProfileRow>`

---

### POST `/admin/profiles`

**What it does:** Creates user + profile with auto-verified status. Server generates a temporary password (not returned in API).

**Sends:**

```ts
{
  profileType: "worker" | "employer";  // required
  fullName: string;                    // required
  email: string;                       // required
  phone: string;                       // required
  locationRegionCity: string;          // required — "City" or "City/Region"
  roleOrPosition?: string;             // worker professional title
  organization?: string;               // employer company name
  shortBio?: string;
}
// profilePhoto multipart — NOT implemented yet
```

**Receives:** `AdminOk<AdminProfileRow>`

**Errors:** `400 BAD_REQUEST` — `{field} is required.` for missing required keys.

---

### PATCH `/admin/profiles/:id`

**What it does:** Updates admin-created profiles only.

**Sends:**

```ts
{
  fullName?: string;
  roleOrPosition?: string;
  organization?: string;
  shortBio?: string;
}
```

**Receives:** `AdminOk<AdminProfileRow>`

**Errors:** `403 FORBIDDEN` — `Only admin-created profiles can be edited.`

---

### PATCH `/admin/profiles/:id/suspend`

**What it does:** Suspends the underlying platform user account (`accountStatus: suspended`).

**Auth:** Bearer + `create_profiles`

**Receives:** `AdminOk<AdminProfileRow>`

**Errors:** `403 FORBIDDEN` — not admin-created.

---

### PATCH `/admin/profiles/:id/activate`

**What it does:** Re-activates a suspended admin-created profile.

**Receives:** `AdminOk<AdminProfileRow>`

---

### DELETE `/admin/profiles/:id`

**What it does:** Permanently deletes the user and profile (admin-created only).

**Receives:** `AdminOk<{ deleted: true }>`

**Errors:** `403 FORBIDDEN` — not admin-created.

---

## Disputes (3)

### Shared dispute object

```ts
type AdminDisputeRow = {
  id: string;
  subject: string;
  description: string;
  status: "open" | "resolved" | "closed";  // in_review merged into open (June 2026)
  priority: "low" | "medium" | "high";
  adminNotes: string | null;
  resolvedBy: string | null;     // admin UUID — NOT resolvedByAdminId
  resolvedAt: string | null;
  engagementId: string | null;
  engagement: {
    id: string;
    jobTitle: string;
    payRate: number;
    payPeriod: string;         // lowercase pay structure
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

**UI:** e.g. `John Ngu (Worker)` from `reporter.fullName` + `reporter.role`. Legacy `worker` / `employer` keys removed.

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

**Notes:** `in_review` filter is accepted and treated as `open` (legacy). API never returns `in_review`.

**Receives:** `AdminPaged<AdminDisputeRow>`

---

### GET `/admin/disputes/:id`

**Receives:** `AdminOk<AdminDisputeRow>`

---

### PATCH `/admin/disputes/:id/resolve`

**What it does:** Marks dispute resolved with decision and notes.

**Sends:**

```ts
{
  resolutionDecision: "approve_worker" | "approve_employer" | "partial" | "dismiss";  // required
  resolutionNotes: string;   // required — visible resolution text
  adminNotes?: string;       // internal only
  refundAmount?: number;     // integer XAF units
  refundChannel?: "mtn_momo" | "orange_money";
}
// supportingDocuments multipart — NOT implemented yet
```

**Receives:** `AdminOk<AdminDisputeRow>` with `status: "resolved"`

**Errors:**

- `400 BAD_REQUEST` — `resolutionDecision is required.`
- `400 BAD_REQUEST` — `resolutionNotes is required.`

---

## Finance (3) — read-only

### Shared payment record

```ts
type AdminFinanceRecord = {
  id: string;
  fapshiTransactionId: string | null;
  amount: number;
  currency: string;
  type: "payout";
  mode: "salary_payment";
  provider: "mtn_momo" | "orange_money";
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";  // UPPERCASE
  from: {
    id: string;
    name: string;
    email: string | null;
    type: "employer";
  };
  to: {
    id: string;
    name: string;
    email: string | null;
    type: "worker";
  };
  engagementId: string;
  payPeriod: string | null;
  receiptNumber: string | null;
  failureReason: string | null;
  initiatedAt: string;
  completedAt: string | null;
};
```

### GET `/admin/finance/records`

**Auth:** Bearer + `view_financial_records`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  status?: string;    // server uppercases e.g. COMPLETED
  provider?: string;  // server uppercases e.g. MTN_MOMO
  search?: string;    // accepted by parseListQuery but not wired in service filter
}
```

**Receives:** `AdminPaged<AdminFinanceRecord>`

---

### GET `/admin/finance/records/:id`

**Receives:** `AdminOk<AdminFinanceRecord>`

---

### GET `/admin/finance/summary`

**Receives:**

```ts
AdminOk<{
  totalTransactions: number;
  totalAmountIn: number;
  totalAmountOut: number;   // always 0 today
  netBalance: number;
}>;
```

---

## Admin accounts (7)

### Shared admin row

```ts
type AdminAccountRow = {
  id: string;
  name: string;           // NOT fullName in response
  email: string;
  role: "super_admin" | "admin_manager" | "verifier" | "support_agent";
  isActive: boolean;
  status: "active" | "pending" | "inactive";  // pending = invitePending
  lastLoginAt: string | null;
  createdBy: string | null;
  createdAt: string;
  departments: { id: string; name: string }[];
  permissions: string[];
};
```

### GET `/admin/admins`

**Auth:** Bearer + `manage_admins`

**Sends query:** pagination + `search` + `role` (`super_admin`, etc.)

**Receives:** `AdminPaged<AdminAccountRow>`

---

### GET `/admin/admins/:id`

**Receives:** `AdminOk<AdminAccountRow>`

---

### POST `/admin/admins`

**What it does:** Creates an active admin with role default permissions. No invite-pending step.

**Sends:**

```ts
{
  fullName: string;   // required — note: response uses name, request uses fullName
  email: string;      // required
  role: "super_admin" | "admin_manager" | "verifier" | "support_agent";  // required
  departmentId?: string;
  password?: string;  // optional — min 8 chars; default Joballa+Admin2026!
}
```

**Receives:** `AdminOk<AdminAccountRow>` with `status: "active"` (not `pending`).

**Default password** (when `password` omitted): `Joballa+Admin2026!` — share securely with new admins in dev/staging; change after first login in production.

---

### PATCH `/admin/admins/:id`

**Sends:**

```ts
{
  fullName?: string;
  email?: string;
  role?: "admin_manager" | "verifier" | "support_agent";  // not super_admin
  password?: string;   // min 8 chars — super_admin caller only
}
```

**Receives:** `AdminOk<AdminAccountRow>`

**Errors:**

- `400 BAD_REQUEST` — super admin role cannot be changed or assigned
- `403 FORBIDDEN` — only super admin can set/reset another admin's password

Super admin accounts remain protected from role changes, suspension, and deletion.

---

### PATCH `/admin/admins/:id/suspend`

**Errors:** `400 BAD_REQUEST` — `Super admin cannot be suspended.`

**Receives:** `AdminOk<AdminAccountRow>`

---

### PATCH `/admin/admins/:id/activate`

**What it does:** Sets active and clears `invitePending`.

**Receives:** `AdminOk<AdminAccountRow>`

---

### DELETE `/admin/admins/:id`

**Receives:** `AdminOk<{ deleted: true }>`

**Errors:** `400 BAD_REQUEST` — `Super admin cannot be deleted.`

---

## Permissions (7)

### GET `/admin/permissions`

**What it does:** Lists all admins with permissions + departments (paginated).

**Auth:** Bearer + `manage_admins`

**Receives:**

```ts
AdminPaged<{
  adminId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  departments: { id: string; name: string }[];
}>;
```

---

### GET `/admin/permissions/:adminId`

**Receives:**

```ts
AdminOk<{
  adminId: string;
  permissions: string[];
  departments: { id: string; name: string }[];
}>;
```

---

### PUT `/admin/permissions/:adminId`

**What it does:** **Replaces** entire permission list and department assignments (full arrays — not a patch).

**Sends:**

```ts
{
  permissions: string[];    // complete desired list
  departmentIds: string[];  // complete desired list
}
```

**Receives:** Same as `GET /admin/permissions/:adminId`

**Note:** Super admin effective permissions cannot be reduced; server keeps full set.

---

### POST `/admin/permissions/:adminId/grant`

**Sends:**

```ts
{ permission: string; }   // required — exact permission key
```

**Receives:** Same as `GET /admin/permissions/:adminId`

---

### DELETE `/admin/permissions/:adminId/revoke/:permission`

**Sends:** Path `permission` — URL-encoded permission string (e.g. `verify_kyc`).

**Errors:** `400 BAD_REQUEST` — `Cannot revoke super admin permissions.`

**Receives:** Same as `GET /admin/permissions/:adminId`

---

### POST `/admin/permissions/:adminId/departments`

**Sends:**

```ts
{ departmentId: string; }   // required
```

**Receives:** Same as `GET /admin/permissions/:adminId`

---

### DELETE `/admin/permissions/:adminId/departments/:deptId`

**Sends:** Path `deptId` — department id.

**Receives:** Same as `GET /admin/permissions/:adminId`

---

## Common frontend mistakes (read this)

| Wrong | Correct |
| --- | --- |
| `fullName` on login session | `session.name` |
| `fullName` in PATCH `/admin/me` | `name` |
| `rejectionReason` in reject body | `reason` |
| `resolvedByAdminId` on disputes | `resolvedBy` |
| `worker` / `employer` on disputes | `reporter` / `reported` |
| `in_review` dispute status | `open` |
| `workMode` on job objects | `jobType` |
| `GET /admin/jobs/:id` | Use list row — no detail route |
| Worker-style pagination `{ page, limit, total }` at root | Admin uses `{ success, data, meta }` |
| Sending `email` only without password on login | Both `identifier` + `password` required |
| PATCH profile with snake_case keys | Use camelCase exactly as documented |

---

## Route index (62 total)

| # | Method | Path |
| --- | --- | --- |
| 1 | POST | `/admin/auth/login` |
| 2 | POST | `/admin/auth/refresh` |
| 3 | POST | `/admin/auth/logout` |
| 4 | GET | `/admin/dashboard` |
| 5 | GET | `/admin/dashboard/analytics` |
| 6 | GET | `/admin/dashboard/export` |
| 7 | GET | `/admin/me` |
| 8 | PATCH | `/admin/me` |
| 9 | GET | `/admin/logs` |
| 10–14 | GET/PATCH | `/admin/kyc`, `/admin/kyc/:id`, approve, reject, status |
| 15–18 | GET/PATCH | `/admin/documents`, … |
| 19–24 | GET/PATCH | `/admin/jobs`, pending, rejected, approve, reject, status |
| 25–29 | GET/POST/PATCH/DELETE | `/admin/departments` (suspend/activate removed) |
| 30–34 | GET/PATCH/DELETE | `/admin/users`, … |
| 35–41 | GET/POST/PATCH/DELETE | `/admin/profiles`, suspend, activate, … |
| 42–44 | GET/PATCH | `/admin/disputes`, … |
| 45–47 | GET | `/admin/finance/records`, `:id`, `/summary` |
| 48–54 | GET/POST/PATCH/DELETE | `/admin/admins`, … |
| 55–62 | GET/PUT/POST/DELETE | `/admin/permissions`, … |

---

## Document history

| Date | Change |
| --- | --- |
| May 2026 | Analytics, export, KYC status, admin role/password edit, profile suspend/activate, logs `adminRole`, verifier permission defaults |
| June 2026 | Full per-route request/response reference for frontend integration |
| June 2026 | Admin UI requirements: application source, department metrics, nullable job department, disputes reporter/reported, dashboard read access, suspended auth — see [BACKEND_RESPONSE_ADMIN_JUNE_2026_REQUIREMENTS.md](./BACKEND_RESPONSE_ADMIN_JUNE_2026_REQUIREMENTS.md) |
