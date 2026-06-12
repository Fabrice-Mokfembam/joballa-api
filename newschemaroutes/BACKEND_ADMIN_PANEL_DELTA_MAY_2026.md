# Admin Panel Backend — May 2026 Delta

**Audience:** Backend team  
**Base path:** `/admin` (no `/api` prefix)  
**Production:** `https://joballa-api.onrender.com`  
**Local:** `http://127.0.0.1:8000`

This document covers **only what changed** since the June 2026 admin baseline (58 routes). The full 64-route contract lives in [FRONTEND_ADMIN_ROUTES.md](./FRONTEND_ADMIN_ROUTES.md).

---

## How to read this document

Each route section has:

1. **What it does** — server behaviour  
2. **Auth** — Bearer token + permission string  
3. **Sends** — path params, query params, JSON body (exact keys)  
4. **Receives** — success JSON shape (exact keys under `data`)  
5. **Errors** — common validation failures  

Admin JSON uses **camelCase** API names. Do not guess from database column names.

---

## Shared contracts (unchanged baseline)

### Headers (all protected routes)

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Exception: `GET /admin/dashboard/export` returns CSV, not JSON.

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
  };
};
```

### Error

```ts
type AdminError = {
  success: false;
  error: {
    code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST";
    message: string;
  };
};
```

HTTP status matches the error (401 / 403 / 404 / 400).

---

## Behaviour changes (no new route)

### Default permissions by role

When `POST /admin/admins` creates an account, the server seeds permissions from role defaults in `admin.constants.ts`.

| Role | Default `permissions[]` |
| --- | --- |
| `super_admin` | All permission strings |
| `admin_manager` | Full manager set including `create_profiles` |
| `verifier` | `verify_jobs`, `resolve_disputes`, `verify_documents`, `verify_kyc` |
| `support_agent` | `create_profiles` |

`create_profiles` is **not** a verifier default. Grant explicitly via `/admin/permissions` if needed.

**Migration:** Existing verifier rows in `admin_permissions` are not auto-revoked.

---

### Admin-created profile visibility

Applies to **all** profile routes: list, detail, edit, suspend, activate, delete.

| Caller | Database filter |
| --- | --- |
| `super_admin` | `createdByAdminId IS NOT NULL` (all admin-created profiles) |
| Any other admin with `create_profiles` | `createdByAdminId = caller.adminId` only |

Admin managers are **not** exempt. Out-of-scope profile id → `404 NOT_FOUND` (`Profile not found.`).

**Code:** `profileScopeWhere()` in `src/modules/v2/admin/admin-mappers.ts`.

---

## New & changed routes (6)

### GET `/admin/dashboard/analytics` — **NEW**

**What it does:** Returns rich dashboard analytics for chart widgets (KPIs, time series, funnel, top departments, recent audit activity).

**Auth:** Bearer + `view_platform_analytics`

**Sends query:**

```ts
{
  range?: "7d" | "30d" | "90d" | "1y" | `${number}d`;  // default "30d"
  startDate?: string;  // ISO 8601 — used when overriding range start
  endDate?: string;    // ISO 8601 — default now
}
```

**Receives:**

```ts
type AdminDashboardAnalytics = AdminOk<{
  range: { start: string; end: string };  // ISO 8601
  kpis: {
    totalJobs: number;
    jobsCreatedThisMonth: number;
    totalApplications: number;
    applicationsThisMonth: number;
    activeUsers: number;
    activeUsersThisMonth: number;
    kycSubmissions: number;
    kycSubmissionPercentChange: number;  // vs previous calendar month
    verifiedUsers: number;
    verifiedUsersThisMonth: number;
  };
  applicationsOverTime: Array<{ date: string; applications: number }>;  // date = YYYY-MM-DD
  jobsByStatus: {
    active: number;
    draft: number;
    paused: number;
    closed: number;
  };
  documentsByStatus: {
    approved: number;
    pending: number;
    rejected: number;
  };
  kycFunnel: {
    submitted: number;
    underReview: number;
    verified: number;
    rejected: number;
  };
  applicationsBySource: Array<{ source: string; applications: number }>;
  topDepartments: Array<{
    departmentId: string;
    departmentName: string;
    jobs: number;
    applications: number;
    hires: number;
    conversionRate: number;  // percentage, 2 decimal places
  }>;
  recentActivity: Array<{
    id: string;
    type: string;           // e.g. "kyc.approved"
    description: string;
    createdAt: string;      // ISO 8601
  }>;
}>;
```

**Notes:**

- `applicationsBySource` returns `[{ source: "platform", applications: N }]` until a per-application source column exists.
- `recentActivity` respects the same log visibility rules as `GET /admin/logs`.

**Errors:** `403 FORBIDDEN` — missing `view_platform_analytics`.

---

### GET `/admin/dashboard/export` — **NEW**

**What it does:** Downloads a CSV report built from the same analytics queries as `/admin/dashboard/analytics`.

**Auth:** Bearer + `view_platform_analytics`

**Sends query:**

```ts
{
  range?: string;       // same as analytics
  startDate?: string;
  endDate?: string;
  format?: "csv";       // only supported value; default csv
}
```

**Receives:** Raw CSV body (not JSON).

```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="joballa-admin-report-YYYY-MM-DD.csv"
```

CSV sections: KPI rows, jobs by status, documents by status, KYC funnel.

**Errors:**

- `400 BAD_REQUEST` — `Only format=csv is supported.`
- `403 FORBIDDEN` — missing `view_platform_analytics`

---

### GET `/admin/logs` — **CHANGED response**

**What it does:** Unchanged behaviour (paginated audit log; super admin sees all, admin manager sees non–super-admin, others see own).

**Auth:** Bearer + `view_platform_logs`

**Sends query:** Unchanged — `page`, `limit`, `sort`, `order`, `search`, `module`, `action`, `startDate`, `endDate`, `adminId`.

**Receives:** `AdminPaged<AdminLogRow>` where `AdminLogRow` now includes `adminRole`:

```ts
type AdminLogRow = {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: "super_admin" | "admin_manager" | "verifier" | "support_agent";  // NEW
  action: string;
  module: string;
  details: string;    // target: human-readable, e.g. "Deleted Software department"
  ipAddress: string;  // empty string if unknown
  createdAt: string;  // ISO 8601
};
```

---

### PATCH `/admin/kyc/:id/status` — **NEW**

**What it does:** Unified KYC status transitions.

| `status` in body | Server behaviour |
| --- | --- |
| `pending` | Clears `verifiedAt`, `verifiedByAdminId`, `rejectionReason`; sets submission + worker profile to pending |
| `verified` | Delegates to `PATCH /admin/kyc/:id/approve` |
| `rejected` | Delegates to `PATCH /admin/kyc/:id/reject` |

**Auth:** Bearer + `verify_kyc`

**Sends:**

```ts
// Path: id — KYC submission UUID
{
  status: "pending" | "verified" | "rejected";  // required
  reason?: string;   // required when status is "rejected"
}
```

**Receives:** `AdminOk<AdminKycRow>` (same object as approve/reject — see `FRONTEND_ADMIN_ROUTES.md` KYC section).

**Errors:**

- `400 BAD_REQUEST` — `status must be pending, verified, or rejected.`
- `400 BAD_REQUEST` — `reason is required when rejecting.`
- `404 NOT_FOUND` — `KYC submission not found.`

---

### PATCH `/admin/admins/:id` — **CHANGED body**

**What it does:** Updates an admin account. Super admin accounts remain protected.

**Auth:** Bearer + `manage_admins`

**Sends:**

```ts
// Path: id — admin account UUID
{
  fullName?: string;
  email?: string;
  role?: "admin_manager" | "verifier" | "support_agent";  // NEW — not super_admin
  password?: string;   // NEW — min 8 chars; super_admin caller only
}
```

**Receives:** `AdminOk<AdminAccountRow>`:

```ts
type AdminAccountRow = {
  id: string;
  name: string;        // NOT fullName in response
  email: string;
  role: "super_admin" | "admin_manager" | "verifier" | "support_agent";
  isActive: boolean;
  status: "active" | "pending" | "inactive";
  lastLoginAt: string | null;
  createdBy: string | null;
  createdAt: string;
  permissions: string[];
  departments: { id: string; name: string }[];
};
```

**Errors:**

- `400 BAD_REQUEST` — `Super admin role cannot be changed.`
- `400 BAD_REQUEST` — `Super admin role cannot be assigned.`
- `400 BAD_REQUEST` — `role must be admin_manager, verifier, or support_agent.`
- `400 BAD_REQUEST` — `Password must be at least 8 characters.`
- `403 FORBIDDEN` — `Only super admin can reset admin passwords.`
- `404 NOT_FOUND` — `Admin not found.`

---

### Admin-created profiles — **CHANGED & NEW routes**

#### Shared `AdminProfileRow` (updated fields)

```ts
type AdminProfileRow = {
  id: string;
  userId: string;
  profileType: "worker" | "employer";
  fullName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: null;              // always null until multipart create ships
  dateOfBirth: string | null; // NEW — YYYY-MM-DD, worker only
  accountStatus: "active" | "suspended";  // NEW
  city: string | null;
  region: string | null;
  country: string | null;
  isVerified: boolean;
  verificationStatus: string;
  isAdminCreated: boolean;
  createdByAdmin: string | null;
  memberSince: string;
  profileViews?: number;
  shortBio?: string | null;
  organization?: string;
  role?: string | null;
  profile: object | null;
};
```

#### GET `/admin/profiles` — visibility changed

**Auth:** Bearer + `create_profiles`

**Sends query:**

```ts
{
  page?: number;
  limit?: number;
  order?: "asc" | "desc";
  role?: "worker" | "employer";
  profileType?: "worker" | "employer";
  isAdminCreated?: "true";
  createdByAdmin?: string;   // super_admin only — narrow to specific creator
}
```

**Receives:** `AdminPaged<AdminProfileRow>` scoped per visibility rules above.

#### GET `/admin/profiles/:id`

**Sends:** Path `id` — profile id, user id, worker profile id, or employer profile id.

**Receives:** `AdminOk<AdminProfileRow>`

**Errors:** `404 NOT_FOUND` — `Profile not found.` (includes out-of-scope ids)

#### PATCH `/admin/profiles/:id` — unchanged contract

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

#### PATCH `/admin/profiles/:id/suspend` — **NEW**

**What it does:** Sets underlying `users.accountStatus` to `suspended`.

**Auth:** Bearer + `create_profiles`

**Sends:** Path `id` only. No body.

**Receives:** `AdminOk<AdminProfileRow>`

**Errors:**

- `403 FORBIDDEN` — `Only admin-created profiles can be suspended.`
- `404 NOT_FOUND` — `Profile not found.`

#### PATCH `/admin/profiles/:id/activate` — **NEW**

**What it does:** Sets underlying `users.accountStatus` to `active`.

**Auth:** Bearer + `create_profiles`

**Sends:** Path `id` only. No body.

**Receives:** `AdminOk<AdminProfileRow>`

**Errors:**

- `403 FORBIDDEN` — `Only admin-created profiles can be activated.`
- `404 NOT_FOUND` — `Profile not found.`

#### DELETE `/admin/profiles/:id` — unchanged contract

**Receives:** `AdminOk<{ deleted: true }>`

**Errors:** `403 FORBIDDEN` — `Only admin-created profiles can be deleted.`

---

## Not implemented (product gaps)

### Admin “Post a new job”

No `POST /admin/jobs`. Dashboard action should be removed or deep-link to employer portal.

### POST `/admin/profiles` — multipart photo (target contract)

```http
POST /admin/profiles
Content-Type: multipart/form-data
Authorization: Bearer <accessToken>
```

```ts
{
  profilePhoto?: File;
  profileType: "worker" | "employer";  // required
  fullName: string;                    // required
  email: string;                       // required
  phone: string;                       // required
  dateOfBirth?: string;                // YYYY-MM-DD — not accepted yet
  locationRegionCity: string;          // required
  roleOrPosition?: string;
  organization?: string;
  shortBio?: string;
}
```

**Receives (target):** `AdminOk<AdminProfileRow>` with `photoUrl` populated when file sent.

**Current:** JSON-only create; `photoUrl` always `null`.

### Departments — simplify to categories (pending product sign-off)

Remove `isActive` from responses and remove:

- `PATCH /admin/departments/:id/suspend`
- `PATCH /admin/departments/:id/activate`

Keep CRUD; block delete when department has active jobs.

### Jobs — `department` null

Jobs always have `departmentId` (required FK). Admin job JSON always returns:

```ts
department: { id: string; name: string; slug: string };  // never null
```

Frontend `"Other"` label is UI-only when department is missing client-side.

---

## Implementation map

| File | Change |
| --- | --- |
| `src/modules/v2/admin/admin.constants.ts` | Verifier defaults (no `create_profiles`) |
| `src/modules/v2/admin/admin-mappers.ts` | `profileScopeWhere` — super admin vs own-only |
| `src/modules/v2/admin/admin-audit.service.ts` | `adminRole` on log rows |
| `src/modules/v2/admin/admin-api-format.ts` | `parseDashboardRange` |
| `src/modules/v2/admin/admin-v2.service.ts` | Analytics, export, KYC status, admin patch, profile suspend/activate, profile fields |
| `src/modules/v2/admin/admin-v2.controller.ts` | New/changed routes |

---

## Suggested smoke tests

1. `GET /admin/dashboard/analytics?range=30d` as admin with `view_platform_analytics`  
2. `GET /admin/dashboard/export?format=csv` — assert `Content-Disposition` and CSV body  
3. `GET /admin/logs` — each row has `adminRole`  
4. `PATCH /admin/kyc/:id/status` `{ "status": "pending" }` on a verified submission  
5. `PATCH /admin/admins/:id` `{ "role": "verifier" }` as super admin  
6. `PATCH /admin/admins/:id` `{ "password": "NewPass123!" }` as non–super-admin → `403`  
7. Support agent lists profiles → only own `createdByAdminId` rows  
8. Super admin lists profiles → all admin-created rows  
9. `PATCH /admin/profiles/:id/suspend` then `activate` on admin-created profile  

---

## Route count

| Baseline (June 2026) | After May 2026 delta |
| --- | --- |
| 58 | 64 |

Added: `dashboard/analytics`, `dashboard/export`, `kyc/:id/status`, `profiles/:id/suspend`, `profiles/:id/activate`.
