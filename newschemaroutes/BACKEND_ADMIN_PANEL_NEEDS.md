# Admin Panel Backend Needs & Contract Tracker

**Audience:** Backend team  
**Base path:** `/admin`  
**Full 64-route reference:** [FRONTEND_ADMIN_ROUTES.md](./FRONTEND_ADMIN_ROUTES.md)  
**May 2026 delta (send this for handoff):** [BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md](./BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md)

---

## How to read this document

- **Done** sections spell out the **implemented contract** (same format as the main route doc).  
- **Open** sections spell out the **target contract** backend still needs to build.  
- Status tables are summaries only; route sections are authoritative.

### Shared envelopes (all admin routes)

```ts
type AdminOk<T> = { success: true; data: T };

type AdminPaged<T> = {
  success: true;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type AdminError = {
  success: false;
  error: {
    code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST";
    message: string;
  };
};
```

Protected routes require:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

---

## Resolved — June 2026 baseline

These shipped before the May 2026 delta. Full per-route contracts are in `FRONTEND_ADMIN_ROUTES.md`.

| Area | Routes / behaviour |
| --- | --- |
| Auth & session | `POST /admin/auth/login`, `refresh`, `logout`; `GET/PATCH /admin/me`; `session` object on login |
| Pagination | `{ success, data: T[], meta }` on all list routes |
| Jobs | `GET pending`, `GET rejected`, `PATCH :id/status` |
| Finance | `GET /admin/finance/records`, `records/:id`, `summary` |
| Logs | `GET /admin/logs` with role-based visibility |
| Admins create | `POST /admin/admins` with optional `password`, active immediately |

---

## Resolved — May 2026 update

### Dashboard analytics — **Done**

#### GET `/admin/dashboard/analytics`

**Auth:** Bearer + `view_platform_analytics`

**Sends query:**

```ts
{ range?: "7d" | "30d" | "90d" | "1y" | `${number}d`; startDate?: string; endDate?: string; }
```

**Receives:** `AdminOk<AdminDashboardAnalytics>` — see [BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md](./BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md) for full `data` shape.

#### GET `/admin/dashboard/export`

**Auth:** Bearer + `view_platform_analytics`

**Sends query:** Same as analytics + `format=csv`

**Receives:** CSV file with `Content-Disposition: attachment`

---

### Logs `adminRole` — **Done**

#### GET `/admin/logs` (response field added)

```ts
type AdminLogRow = {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: "super_admin" | "admin_manager" | "verifier" | "support_agent";
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  createdAt: string;
};
```

---

### KYC status transitions — **Done**

#### PATCH `/admin/kyc/:id/status`

**Auth:** Bearer + `verify_kyc`

**Sends:**

```ts
{ status: "pending" | "verified" | "rejected"; reason?: string; }
```

**Receives:** `AdminOk<AdminKycRow>`

| Transition | Supported |
| --- | --- |
| → verified | Yes (`approve` or `status`) |
| → rejected | Yes (`reject` or `status` + `reason`) |
| verified → pending | Yes |
| rejected → pending | Yes |
| verified → rejected | Yes |
| rejected → verified | Yes |

---

### Admin edit role & password — **Done**

#### PATCH `/admin/admins/:id`

**Auth:** Bearer + `manage_admins`

**Sends:**

```ts
{
  fullName?: string;
  email?: string;
  role?: "admin_manager" | "verifier" | "support_agent";
  password?: string;   // super_admin caller only, min 8 chars
}
```

**Receives:** `AdminOk<AdminAccountRow>`

Super admin: protected from role change, suspend, delete.

---

### Permissions defaults — **Done**

| Role | Default permissions |
| --- | --- |
| `verifier` | `verify_jobs`, `resolve_disputes`, `verify_documents`, `verify_kyc` |
| `support_agent` | `create_profiles` |
| `admin_manager` | Manager set including `create_profiles` |
| `super_admin` | All |

---

### Admin-created profiles — **Done**

#### Visibility (all profile routes)

| Caller | Scope |
| --- | --- |
| `super_admin` | All rows with `createdByAdminId` set |
| Other admins with `create_profiles` | `createdByAdminId = caller id` only |

#### Shared response `AdminProfileRow`

```ts
{
  id: string;
  userId: string;
  profileType: "worker" | "employer";
  fullName: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: null;
  dateOfBirth: string | null;
  accountStatus: "active" | "suspended";
  // ... city, region, country, isVerified, verificationStatus,
  // isAdminCreated, createdByAdmin, memberSince, profile, etc.
}
```

#### Routes

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| GET | `/admin/profiles` | `create_profiles` | query: page, limit, role, profileType, createdByAdmin (super only) | `AdminPaged<AdminProfileRow>` |
| GET | `/admin/profiles/:id` | `create_profiles` | — | `AdminOk<AdminProfileRow>` |
| POST | `/admin/profiles` | `create_profiles` | JSON create fields | `AdminOk<AdminProfileRow>` |
| PATCH | `/admin/profiles/:id` | `create_profiles` | fullName, roleOrPosition, organization, shortBio | `AdminOk<AdminProfileRow>` |
| PATCH | `/admin/profiles/:id/suspend` | `create_profiles` | — | `AdminOk<AdminProfileRow>` |
| PATCH | `/admin/profiles/:id/activate` | `create_profiles` | — | `AdminOk<AdminProfileRow>` |
| DELETE | `/admin/profiles/:id` | `create_profiles` | — | `AdminOk<{ deleted: true }>` |

Mutations require `createdByAdminId` on the target user (`403` otherwise).

---

## Open — still needed

### Dashboard — post job — **Open**

**Target:** None. Product decision: remove admin dashboard “Post job” or link to employer portal.

There is no target contract for `POST /admin/jobs`.

---

### Dashboard — export formats — **Partial**

**Done:** `GET /admin/dashboard/export?format=csv`

**Open target:**

```http
GET /admin/dashboard/export?format=pdf
GET /admin/dashboard/export?format=xlsx
```

Not implemented. Only CSV today.

---

### Logs — human-readable `details` — **Partial**

**Done:** `adminRole` field on each row.

**Open:** Normalize all `audit.log()` messages to concise copy:

| Example `details` |
| --- |
| `Deleted Software department` |
| `Updated Jim's permissions` |
| `Created a new profile` |
| `Approved Alice Choua's KYC` |

Many routes still log UUID-heavy strings.

---

### POST `/admin/profiles` multipart — **Open**

**Target contract:**

```http
POST /admin/profiles
Content-Type: multipart/form-data
Authorization: Bearer <accessToken>
```

**Sends (form fields):**

```ts
{
  profilePhoto?: File;
  profileType: "worker" | "employer";
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;       // YYYY-MM-DD
  locationRegionCity: string;
  roleOrPosition?: string;
  organization?: string;
  shortBio?: string;
}
```

**Receives (target):**

```ts
AdminOk<AdminProfileRow>;  // photoUrl: string | null when file uploaded
```

**Current:** JSON body only; `photoUrl` always `null`; `dateOfBirth` not accepted on create.

---

### Departments — category-only model — **Open**

**Target behaviour:** Departments are simple categories (active until deleted).

**Remove from API:**

- `isActive` / status on create, update, list, detail responses  
- `PATCH /admin/departments/:id/suspend`  
- `PATCH /admin/departments/:id/activate`  

**Keep:**

| Method | Path |
| --- | --- |
| GET | `/admin/departments` |
| GET | `/admin/departments/:id` |
| POST | `/admin/departments` |
| PATCH | `/admin/departments/:id` |
| DELETE | `/admin/departments/:id` |

**Delete rule:** `400` when department has active jobs.

**Current:** Suspend/activate routes still exist.

---

### Application source analytics — **Open**

**Target `applicationsBySource` shape:**

```ts
Array<{ source: string; applications: number }>;
```

**Current:** Single bucket `{ source: "platform", applications: N }` because `applications` table has no `source` column.

**Backend work:** Add column + populate on apply, then aggregate in `getDashboardAnalytics`.

---

### Jobs — department null — **Clarified (no change needed)**

Admin job responses always include:

```ts
department: { id: string; name: string; slug: string };
```

DB requires `departmentId`. Frontend `"Other"` is a display fallback only.

---

## Route count

| Version | Count |
| --- | --- |
| June 2026 baseline | 58 |
| May 2026 (current) | 64 |

---

## Which document to send

| Document | When to use |
| --- | --- |
| **BACKEND_ADMIN_PANEL_DELTA_MAY_2026.md** | Primary handoff — what changed, full contracts for changed routes |
| **BACKEND_ADMIN_PANEL_NEEDS.md** | Living tracker — done vs open with target contracts |
| **FRONTEND_ADMIN_ROUTES.md** | Complete 64-route reference for frontend alignment |
