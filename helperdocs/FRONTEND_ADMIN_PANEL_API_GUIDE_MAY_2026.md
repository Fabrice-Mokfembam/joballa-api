# Joballa Admin Panel — Frontend API Guide

**Last updated:** May 31, 2026  
**Base path:** `/admin` (prepend your API host, e.g. `https://joballa-api.onrender.com`)  
**Audience:** Frontend developers building the admin portal (`/admin/*` pages)

This document is the **authoritative integration guide** for every admin backend route currently implemented. It describes what each route does, what it requires, how the server processes the request, what it returns, and common errors.

**Payload reference (frontend audit):** [`docsfromfrontend/admin-api-routes-comprehensive.md`](../docsfromfrontend/admin-api-routes-comprehensive.md)

**Related specs (internal):**

- **Auth & refresh (required reading):** [FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md](./FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md)
- Database: [`docs/database-data-structure.md`](../docs/database-data-structure.md) — `departments` table (May 2026)
- Backend module notes: `docs/routes/07-admin-panel.md`

---

## Table of contents

1. [Overview](#1-overview)
2. [Authentication & headers](#2-authentication--headers)
3. [Roles, permissions & department scoping](#3-roles-permissions--department-scoping)
4. [Response envelopes](#4-response-envelopes)
5. [Shared query parameters & mutation bodies](#5-shared-query-parameters--mutation-bodies)
6. [Error handling](#6-error-handling)
7. [Route index (all routes)](#7-route-index-all-routes)
8. [Auth routes (`/admin/auth`)](#8-auth-routes-adminauth)
9. [Dashboard](#9-dashboard)
10. [KYC verification](#10-kyc-verification)
11. [Documents](#11-documents)
12. [Jobs moderation](#12-jobs-moderation)
13. [Reports / disputes](#13-reports--disputes)
14. [Admin accounts](#14-admin-accounts)
15. [Departments & department admins](#15-departments--department-admins)
16. [Platform users (workers & employers)](#16-platform-users-workers--employers)
17. [Analytics](#17-analytics)
18. [Settings](#18-settings)
19. [Audit logs](#19-audit-logs)
20. [Status value reference](#20-status-value-reference)
21. [Frontend QA checklist](#21-frontend-qa-checklist)
22. [Document history](#22-document-history)

---

## 1. Overview

The admin API powers the Joballa moderation portal:

- **Sign-in & session** for `ADMIN` and `SUPER_ADMIN` users
- **Dashboard** metrics and queue previews
- **KYC**, **documents**, and **jobs** review workflows
- **Reports** (disputes) resolution
- **Department admin** management
- **Super-admin-only** areas: platform users, analytics, settings, global audit logs, destructive actions

All successful admin panel responses use a **consistent envelope** (`success`, `data`, `message`). List endpoints return paginated `data` objects.

---

## 2. Authentication & headers

**Full guide (login, refresh, logout, TypeScript examples):** [FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md](./FRONTEND_AUTH_AND_REFRESH_GUIDE_MAY_2026.md)

### 2.1 Summary

- Login: `POST /admin/auth/login` → store **`data.accessToken`** and **`data.refreshToken`**.
- Refresh: `POST /admin/auth/refresh` with body `{ "refreshToken": "..." }` — **no valid access token required**.
- Protected routes: `Authorization: Bearer <accessToken>` on all other `/admin/*` calls.
- On **401** → refresh once, retry; if refresh fails → login page.

### 2.4 First super admin (bootstrap)

If no super admin exists yet, ops creates one via CLI (not a public API):

```bash
npm run create:admin
# or: node scripts/create-admin.mjs --email=... --password=... --role=super_admin
```

After that, additional admins are created via `POST /admin/admins` or `POST /admin/departments` (super admin JWT required).

---

## 3. Roles, permissions & department scoping

### 3.1 Roles

| API `role` value   | DB role        | Scope |
|--------------------|----------------|-------|
| `super_admin`      | `SUPER_ADMIN`  | Entire platform |
| `admin`            | `ADMIN`        | Permission-based moderation (no `departmentId` on session) |

### 3.2 Permission strings

Returned on `GET /admin/auth/me` as `data.permissions`. Routes declare a required permission; the guard rejects missing permissions with **403**.

| Permission            | Typical use |
|-----------------------|-------------|
| `auth:session`        | Logout, refresh, me, change password |
| `dashboard:read`      | Dashboard |
| `kyc:read` / `kyc:review` | KYC list/detail vs approve/reject |
| `documents:read` / `documents:review` | Document list/detail vs review actions |
| `jobs:read` / `jobs:moderate` | Job list/detail vs moderation |
| `reports:read` / `reports:resolve` | Reports list/detail vs resolve/close |
| `departments:read` / `departments:manage` | Department list vs create/update/delete |
| `admins:manage`       | Create admins, reset department admin password |
| `users:read` / `users:manage` | Platform user list/detail/actions (**super admin only**) |
| `analytics:read`      | Analytics (**super admin only**) |
| `settings:manage`     | Settings (**super admin only**) |
| `audit_logs:read`     | Audit logs & entity audit drawers |

**Super admin** receives **all** permissions. **Department admin** receives the moderation subset (no `users:*`, `analytics:read`, `settings:manage`, `departments:manage`, `admins:manage`).

### 3.3 Department scoping (department admin)

When `role === 'admin'`:

- `GET /admin/auth/me` returns `id`, `name`, `email`, `role`, `permissions`, `status` — **no** `departmentId` / `departmentName`.
- List endpoints for **documents** and **jobs** filter to the admin’s `departmentCategory` where applicable.
- **Departments** list returns only the assigned department (super admin sees all).
- Some actions (delete job/report/document, assign job department, user management, analytics, settings) call `assertSuperAdmin` and return **403** for department admins even if they have a related permission on paper.

Always use **`permissions`** from `/admin/auth/me` to hide UI, not role alone.

---

## 4. Response envelopes

### 4.1 Success (single resource or action)

```json
{
  "success": true,
  "data": { },
  "message": "Action completed successfully."
}
```

### 4.2 Success (paginated list)

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  },
  "message": "Action completed successfully."
}
```

### 4.3 HTTP status codes (success)

| Code | When |
|------|------|
| `200` | OK (most GET/POST/PATCH actions) |
| `201` | Created (`POST /admin/admins`, `POST /admin/departments`) |

---

## 5. Shared query parameters & mutation bodies

### 5.1 Pagination & filters (list routes)

Query parameters (all optional unless noted):

| Parameter   | Type   | Default | Description |
|------------|--------|---------|-------------|
| `page`     | number | `1`     | Page index (≥ 1) |
| `limit`    | number | `20`    | Page size (1–100) |
| `search`   | string | —       | Free-text search (field varies per resource) |
| `status`   | string | —       | Status filter (API string; see [§20](#20-status-value-reference)) |
| `sortBy`   | string | —       | Reserved / future use |
| `sortOrder`| `asc` \| `desc` | — | Reserved / future use |

**Resource-specific query flags:**

| Route | Extra query | Meaning |
|-------|-------------|---------|
| `GET /admin/documents` | `unresolved=true` | Pending, rejected, or resubmission_requested only |
| `GET /admin/jobs` | `moderationQueue=true` | Draft, pending_review, or rejected jobs |
| `GET /admin/users` | `role=worker` \| `employer` | Filter platform users |
| `GET /admin/analytics/earnings` | `from`, `to` | ISO date strings for payment aggregation window |

Send `page` and `limit` as **numbers** in JSON APIs; in URL query strings they are parsed server-side to numbers.

### 5.2 Approve body

```json
{
  "note": "Optional internal note (max 2000 chars)"
}
```

Used by: KYC/job/document approve routes.

### 5.3 Reject / resubmission / resolve body

```json
{
  "reason": "Required user-facing reason (max 500 chars)",
  "note": "Optional internal note (max 2000 chars)"
}
```

Used by: KYC reject & request-resubmission, document reject & request-resubmission, job reject, report resolve.

### 5.4 Add note body

```json
{
  "note": "Required internal note (max 2000 chars)"
}
```

### 5.5 Assign department (jobs)

```json
{
  "departmentId": "uuid-of-joballa-department-employer-profile"
}
```

---

## 6. Error handling

The API uses NestJS **global exception** format (not the `success: false` shape from the product sketch). Example:

```json
{
  "statusCode": 403,
  "error": "ForbiddenException",
  "message": "You do not have permission to perform this action.",
  "path": "/admin/users",
  "timestamp": "2026-05-22T12:00:00.000Z"
}
```

### 6.1 Common status codes

| Code | Meaning | Typical `message` |
|------|---------|-------------------|
| `400` | Validation failed | Array of field errors from `class-validator`, or business rule text |
| `401` | Missing/invalid JWT | Unauthorized |
| `403` | Wrong role or permission | Not an admin / permission denied / super admin required |
| `404` | Resource not found | e.g. `KYC submission not found.` |
| `409` | Conflict | e.g. `Email already in use.` |
| `429` | Rate limit | Throttled (auth routes) |
| `500` | Server error | `Internal server error` |

### 6.2 Validation errors (`400`)

When the body fails DTO validation, `message` is often a **string array**:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": [
    "reason should not be empty",
    "reason must be a string"
  ],
  "path": "/admin/kyc/abc/reject",
  "timestamp": "..."
}
```

### 6.3 Frontend handling pattern

```typescript
function formatApiError(err: unknown): string {
  if (!axios.isAxiosError(err) || !err.response) {
    return 'Network error. Check your connection.';
  }
  const { status, data } = err.response;
  const msg = data?.message;
  const text = Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Request failed');
  switch (status) {
    case 401:
      return 'Session expired. Please sign in again.';
    case 403:
      return text || 'You do not have permission for this action.';
    case 404:
      return text || 'Resource not found.';
    case 409:
      return text || 'Conflict — record may already exist.';
    default:
      return text;
  }
}
```

---

## 7. Route index (all routes)

| # | Method | Route | Permission | Super admin only |
|---|--------|-------|------------|------------------|
| 1 | POST | `/admin/auth/login` | — (public) | |
| 2 | POST | `/admin/auth/logout` | `auth:session` | |
| 3 | POST | `/admin/auth/refresh` | `auth:session` | |
| 4 | GET | `/admin/auth/me` | `auth:session` | |
| 5 | POST | `/admin/auth/forgot-password` | — (public) | |
| 6 | POST | `/admin/auth/reset-password` | — (public) | |
| 7 | POST | `/admin/auth/change-password` | `auth:session` | |
| 8 | GET | `/admin/dashboard` | `dashboard:read` | |
| 9 | GET | `/admin/kyc` | `kyc:read` | |
| 10 | GET | `/admin/kyc/:kycId` | `kyc:read` | |
| 11 | POST | `/admin/kyc/:kycId/approve` | `kyc:review` | |
| 12 | POST | `/admin/kyc/:kycId/reject` | `kyc:review` | |
| 13 | POST | `/admin/kyc/:kycId/request-resubmission` | `kyc:review` | |
| 14 | POST | `/admin/kyc/:kycId/notes` | `kyc:review` | |
| 15 | GET | `/admin/kyc/:kycId/audit-log` | `audit_logs:read` | |
| 16 | GET | `/admin/documents` | `documents:read` | |
| 17 | GET | `/admin/documents/:documentId` | `documents:read` | |
| 18 | POST | `/admin/documents/:documentId/approve` | `documents:review` | |
| 19 | POST | `/admin/documents/:documentId/reject` | `documents:review` | |
| 20 | POST | `/admin/documents/:documentId/request-resubmission` | `documents:review` | |
| 21 | POST | `/admin/documents/:documentId/notes` | `documents:review` | |
| 22 | POST | `/admin/documents/:documentId/delete` | `documents:review` | **Yes** (service check) |
| 23 | GET | `/admin/documents/:documentId/audit-log` | `audit_logs:read` | |
| 24 | GET | `/admin/jobs` | `jobs:read` | |
| 25 | GET | `/admin/jobs/:jobId` | `jobs:read` | |
| 26 | POST | `/admin/jobs/:jobId/approve` | `jobs:moderate` | |
| 27 | POST | `/admin/jobs/:jobId/reject` | `jobs:moderate` | |
| 28 | POST | `/admin/jobs/:jobId/suspend` | `jobs:moderate` | |
| 29 | POST | `/admin/jobs/:jobId/restore` | `jobs:moderate` | |
| 30 | DELETE | `/admin/jobs/:jobId` | `jobs:moderate` | **Yes** |
| 31 | POST | `/admin/jobs/:jobId/assign-department` | `departments:manage` | **Yes** |
| 32 | POST | `/admin/jobs/:jobId/notes` | `jobs:moderate` | |
| 33 | GET | `/admin/jobs/:jobId/audit-log` | `audit_logs:read` | |
| 34 | GET | `/admin/reports` | `reports:read` | |
| 35 | GET | `/admin/reports/:reportId` | `reports:read` | |
| 36 | POST | `/admin/reports/:reportId/notes` | `reports:resolve` | |
| 37 | POST | `/admin/reports/:reportId/escalate` | `reports:resolve` | |
| 38 | POST | `/admin/reports/:reportId/resolve` | `reports:resolve` | |
| 39 | POST | `/admin/reports/:reportId/close` | `reports:resolve` | |
| 40 | DELETE | `/admin/reports/:reportId` | `reports:resolve` | **Yes** |
| 41 | GET | `/admin/admins` | `admins:manage` | **Yes** |
| 41a | GET | `/admin/admins/:adminId` | `admins:manage` | **Yes** |
| 41b | POST | `/admin/admins` | `admins:manage` | **Yes** |
| 41c | PATCH | `/admin/admins/:adminId` | `admins:manage` | **Yes** |
| 41d | DELETE | `/admin/admins/:adminId` | `admins:manage` | **Yes** |
| 41e | POST | `/admin/admins/:adminId/suspend` | `admins:manage` | **Yes** |
| 41f | POST | `/admin/admins/:adminId/reactivate` | `admins:manage` | **Yes** |
| 41g | POST | `/admin/admins/:adminId/reset-password` | `admins:manage` | **Yes** |
| 41h | POST | `/admin/admins/:adminId/resend-invite` | `admins:manage` | **Yes** |
| 42 | GET | `/admin/departments` | `departments:read` | |
| 43 | GET | `/admin/departments/:departmentId` | `departments:read` | |
| 44 | POST | `/admin/departments` | `departments:manage` | **Yes** |
| 45 | PATCH | `/admin/departments/:departmentId` | `departments:manage` | **Yes** |
| 46 | DELETE | `/admin/departments/:departmentId` | `departments:manage` | **Yes** |
| 47 | POST | `/admin/departments/:departmentId/activate` | `departments:manage` | **Yes** |
| 48 | POST | `/admin/departments/:departmentId/suspend` | `departments:manage` | **Yes** |
| 49 | POST | `/admin/departments/:departmentId/reactivate` | `departments:manage` | **Yes** |
| 50 | POST | `/admin/departments/:departmentId/employer` | `departments:manage` | **Yes** |
| 51 | GET | `/admin/departments/:departmentId/jobs` | `jobs:read` | |
| 52 | GET | `/admin/departments/:departmentId/documents` | `documents:read` | |
| 53 | GET | `/admin/departments/:departmentId/activity` | `audit_logs:read` | |
| 54 | GET | `/admin/users` | `users:read` | **Yes** |
| 55 | GET | `/admin/users/:userId` | `users:read` | **Yes** |
| 56 | POST | `/admin/users/:userId/suspend` | `users:manage` | **Yes** |
| 57 | POST | `/admin/users/:userId/reactivate` | `users:manage` | **Yes** |
| 58 | DELETE | `/admin/users/:userId` | `users:manage` | **Yes** |
| 59 | GET | `/admin/analytics/overview` | `analytics:read` | **Yes** |
| 60 | GET | `/admin/analytics/departments` | `analytics:read` | **Yes** |
| 61 | GET | `/admin/analytics/earnings` | `analytics:read` | **Yes** |
| 62 | GET | `/admin/settings` | `settings:manage` | **Yes** |
| 63 | PATCH | `/admin/settings` | `settings:manage` | **Yes** |
| 64 | GET | `/admin/settings/moderation` | `settings:manage` | **Yes** |
| 65 | PATCH | `/admin/settings/moderation` | `settings:manage` | **Yes** |
| 66 | GET | `/admin/settings/document-requirements` | `settings:manage` | **Yes** |
| 67 | PATCH | `/admin/settings/document-requirements` | `settings:manage` | **Yes** |
| 68 | GET | `/admin/settings/notifications` | `settings:manage` | **Yes** |
| 69 | PATCH | `/admin/settings/notifications` | `settings:manage` | **Yes** |
| 70 | GET | `/admin/settings/department-categories` | `settings:manage` | **Yes** |
| 71 | PATCH | `/admin/settings/department-categories` | `settings:manage` | **Yes** |
| 72 | GET | `/admin/audit-logs` | `audit_logs:read` | **Yes** |
| 73 | GET | `/admin/audit-logs/:auditLogId` | `audit_logs:read` | **Yes** |

**Dashboard preview:** The dashboard page can use `GET /admin/dashboard` alone, or optionally the same list routes with small `limit`: `GET /admin/kyc?status=pending&limit=3`, `GET /admin/documents?unresolved=true&limit=3`, `GET /admin/jobs?moderationQueue=true&limit=3`.

---

## 8. Auth routes (`/admin/auth`)

### 8.1 `POST /admin/auth/login`

| | |
|---|---|
| **Purpose** | Sign in a department admin or super admin |
| **Auth** | None (public) |
| **Body** | `{ "identifier": "email@joballa.cm", "password": "..." }` — `identifier` is email; password 1–128 chars |

**Processing:**

1. Validates credentials via shared auth service.
2. Rejects non-admin roles with **403** `Not an admin account.`
3. Issues JWT `accessToken` and sets `refreshToken` httpOnly cookie.

**Success (`200`):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "superadmin@joballa.cm",
      "role": "super_admin"
    }
  },
  "message": "Signed in successfully."
}
```

**Errors:** `401` invalid credentials; `403` not admin; `400` validation; `429` throttled.

---

### 8.2 `POST /admin/auth/logout`

| | |
|---|---|
| **Purpose** | End session (revoke refresh token, clear cookie) |
| **Auth** | Bearer + `auth:session` |
| **Body** | None |

**Processing:** Clears refresh cookie, deletes refresh token row, writes audit `admin.logout`.

**Success (`200`):**

```json
{
  "success": true,
  "data": { "loggedOut": true },
  "message": "Logged out successfully."
}
```

---

### 8.3 `POST /admin/auth/refresh`

| | |
|---|---|
| **Purpose** | Issue a new `accessToken` using the `refreshToken` cookie |
| **Auth** | Bearer optional; **cookie required** |
| **Body** | None |

**Processing:** Reads `refreshToken` cookie, validates rotation, returns new access token and rotates refresh cookie.

**Success (`200`):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "Session refreshed."
}
```

**Errors:** `401` if cookie missing, expired, or invalid.

---

### 8.4 `GET /admin/auth/me`

| | |
|---|---|
| **Purpose** | Current admin profile + permission list |
| **Auth** | Bearer + `auth:session` |

**Success (`200`):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Superadmin",
    "email": "superadmin@joballa.cm",
    "role": "super_admin",
    "permissions": [
      "auth:session",
      "dashboard:read",
      "kyc:read",
      "..."
    ],
    "status": "active"
  },
  "message": "Action completed successfully."
}
```

`status` is `active` or `suspended` (from `user.isActive`). Use `permissions` to gate UI.

---

### 8.5 `POST /admin/auth/forgot-password`

| | |
|---|---|
| **Purpose** | Start password reset (sends OTP email if account exists) |
| **Auth** | None |
| **Body** | `{ "identifier": "email@joballa.cm" }` |

**Processing:** Delegates to shared auth; response is generic (no email enumeration).

**Success (`200`):**

```json
{
  "success": true,
  "data": {},
  "message": "If an account exists, a reset code has been sent."
}
```

---

### 8.6 `POST /admin/auth/reset-password`

| | |
|---|---|
| **Purpose** | Complete reset with OTP |
| **Auth** | None |
| **Body** | `{ "identifier": "email", "otp": "123456", "newPassword": "min 8 chars" }` — `otp` must be 6 digits |

**Success (`200`):** `{ "success": true, "data": {}, "message": "..." }`  

**Errors:** `400` invalid/expired OTP; `401` if verification fails.

---

### 8.7 `POST /admin/auth/change-password`

| | |
|---|---|
| **Purpose** | Change password while logged in |
| **Auth** | Bearer + `auth:session` |
| **Body** | `{ "currentPassword": "...", "newPassword": "..." }` |

**Processing:** Verifies current password, hashes new password, audits `admin.change_password`.

**Success (`200`):** `{ "success": true, "data": {}, "message": "Password updated successfully." }`  

**Errors:** `401` `Current password is incorrect.` or `Password not set.`

---

## 9. Dashboard

### 9.1 `GET /admin/dashboard`

| | |
|---|---|
| **Purpose** | Stat cards + preview arrays for KYC, documents, jobs |
| **Auth** | Bearer + `dashboard:read` |
| **Query** | None |

**Processing:** Aggregates counts (pending KYC, pending documents, jobs under review, completed payment sum). Department admins see document/job slices scoped to their category.

**Success (`200`):**

```json
{
  "success": true,
  "data": {
    "stats": [
      { "label": "Pending KYC", "value": 18, "change": "+5 today" },
      { "label": "Pending documents", "value": 42, "change": "+8 today" },
      { "label": "Jobs in review", "value": 27, "change": "" },
      { "label": "Total earnings", "value": "24.8M XAF", "change": "" }
    ],
    "kycSubmissions": [ ],
    "documents": [ ],
    "jobs": [ ]
  },
  "message": "Action completed successfully."
}
```

Preview items match list endpoint shapes (abbreviated for jobs/documents on dashboard).

---

## 10. KYC verification

### 10.1 `GET /admin/kyc`

| | |
|---|---|
| **Purpose** | Paginated KYC submissions |
| **Auth** | `kyc:read` |
| **Query** | [§5.1](#51-pagination--filters-list-routes); `status` = `pending` \| `approved` \| `rejected` \| `resubmission_requested` |

**List item (`data.items[]`):**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "user": "Worker Full Name",
  "email": "worker@example.com",
  "submittedAt": "2026-05-09T10:00:00.000Z",
  "status": "pending",
  "reason": null,
  "type": "Identity and selfie",
  "previewUrls": ["https://...", "https://..."]
}
```

---

### 10.2 `GET /admin/kyc/:kycId`

| | |
|---|---|
| **Purpose** | Single KYC package + `reviewHistory` |
| **Auth** | `kyc:read` |

**Success `data`:** List fields plus `reviewHistory` (`actions[]`, `notes[]` from audit service).

**Errors:** `404` `KYC submission not found.`

---

### 10.3 `POST /admin/kyc/:kycId/approve`

| | |
|---|---|
| **Body** | [Approve body](#52-approve-body) (optional `note`) |
| **Auth** | `kyc:review` |

**Processing:** Sets KYC + worker profile + user to verified; optional review note; audit `kyc.approve`. Returns updated detail (same as GET).

---

### 10.4 `POST /admin/kyc/:kycId/reject`

| | |
|---|---|
| **Body** | [Reject body](#53-reject--resubmission--resolve-body) — **`reason` required** |
| **Auth** | `kyc:review` |

**Processing:** Status `rejected`, stores `rejectionReason`; audit `kyc.reject`.

---

### 10.5 `POST /admin/kyc/:kycId/request-resubmission`

| | |
|---|---|
| **Body** | Same as reject (**`reason` required**) |
| **Auth** | `kyc:review` |

**Processing:** Status `resubmission_requested` (DB: `MORE_INFO_REQUIRED`); audit `kyc.request_resubmission`.

---

### 10.6 `POST /admin/kyc/:kycId/notes`

| | |
|---|---|
| **Body** | [Note body](#54-add-note-body) |
| **Auth** | `kyc:review` |

**Success:** `{ "success": true, "data": { "saved": true }, "message": "Note added." }`

---

### 10.7 `GET /admin/kyc/:kycId/audit-log`

| | |
|---|---|
| **Purpose** | Audit + notes for KYC drawer |
| **Auth** | `audit_logs:read` |

**Success `data`:** `{ "actions": [...], "notes": [...] }`

---

## 11. Documents

### 11.1 `GET /admin/documents`

| | |
|---|---|
| **Purpose** | Paginated worker documents |
| **Auth** | `documents:read` |
| **Query** | §5.1 + `unresolved=true`; `status` = `pending` \| `approved` \| `rejected` \| `resubmission_requested` \| `expired` |

**List item:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "user": "Esther Mbarga",
  "type": "National ID",
  "departmentId": "DOMESTIC",
  "department": "Domestic",
  "submittedAt": "2026-05-23T08:00:00.000Z",
  "status": "pending",
  "risk": "low"
}
```

`risk`: `low` \| `medium` \| `high`.

---

### 11.2 `GET /admin/documents/:documentId`

| | |
|---|---|
| **Purpose** | Detail + file metadata + nested `user` + `reviewHistory` |
| **Auth** | `documents:read` |

**Extra fields:** `file` (`url`, `fileName`, `mimeType`, `sizeBytes`), `rejectionReason`, `reviewHistory`.

---

### 11.3–11.5 Approve / reject / request-resubmission

| Route | Body | Processing |
|-------|------|------------|
| `POST .../approve` | Approve (optional note) | `reviewStatus` → approved |
| `POST .../reject` | Reject (**reason** required) | → rejected |
| `POST .../request-resubmission` | Reject shape | → resubmission_requested |

Each returns full document detail after update.

---

### 11.6 `POST /admin/documents/:documentId/notes`

Note body required → `{ "saved": true }`.

---

### 11.7 `POST /admin/documents/:documentId/delete`

| | |
|---|---|
| **Auth** | `documents:review` + **super admin** |
| **Body** | None |

**Success:** `{ "data": { "deleted": true }, "message": "Document deleted." }`  

**Errors:** `403` for department admin.

---

### 11.8 `GET /admin/documents/:documentId/audit-log`

Same audit shape as KYC (`actions`, `notes`).

---

## 12. Jobs moderation

### 12.1 `GET /admin/jobs`

| | |
|---|---|
| **Query** | `page`, `limit`, `search`, `status` (`draft`, `pending_review`, `rejected`, `published`, `suspended`, `closed`), `moderationQueue=true`, `verifiedOnly=true`, `departmentId` |
| **Auth** | `jobs:read` |

**List item:**

```json
{
  "id": "uuid",
  "title": "Tutor needed",
  "departmentId": "uuid",
  "department": "Joballa Education",
  "clientId": "uuid",
  "client": "Esther Mbarga",
  "pay": "5,000 XAF/hourly",
  "location": "Yaounde",
  "status": "pending_review",
  "availability": "inactive",
  "createdAt": "2026-05-16T09:00:00.000Z",
  "applications": 7
}
```

---

### 12.2 `GET /admin/jobs/:jobId`

Detail adds: `level`, `type`, `cadence`, `startDate`, `duration`, `about`, `requirements[]`, `moderationNotes`, `rejectionReason`.

---

### 12.3 `POST /admin/jobs/:jobId/approve`

Sets job status to **published** (`ACTIVE` in DB). Optional approve note.

---

### 12.4 `POST /admin/jobs/:jobId/reject`

Reject body required → status `rejected`, `adminNotes` combines reason + note.

---

### 12.5 `POST /admin/jobs/:jobId/suspend`

No body → status `suspended` (`PAUSED`).

---

### 12.6 `POST /admin/jobs/:jobId/restore`

No body → status back to **published** (`ACTIVE`).

---

### 12.7 `DELETE /admin/jobs/:jobId`

**Super admin only.** Hard-deletes job.

**Success:** `{ "data": { "deleted": true }, "message": "Job deleted." }`

---

### 12.8 `POST /admin/jobs/:jobId/assign-department`

**Super admin only.** Body: `{ "departmentId": "uuid" }` of a Joballa department (`isJoballaDepartment: true`). Reassigns `employerId` on the job.

**Errors:** `404` `Department not found.`

---

### 12.9 `POST /admin/jobs/:jobId/notes`

Internal note only → `{ "saved": true }`.

---

### 12.10 `GET /admin/jobs/:jobId/audit-log`

Entity audit log for job.

---

## 13. Reports / disputes

Reports are stored as **disputes**. Frontend `/admin/disputes` redirects to `/admin/reports`.

### 13.1 `GET /admin/reports`

| | |
|---|---|
| **Query** | §5.1; `status` = `open` \| `under_review` \| `waiting_for_user` \| `escalated` \| `resolved` \| `closed` |
| **Auth** | `reports:read` |

**List item:**

```json
{
  "id": "uuid",
  "subject": "Payment was not completed...",
  "reporterId": "uuid",
  "reporter": "Esther Mbarga",
  "companyId": "uuid",
  "company": "Private client",
  "status": "under_review",
  "createdAt": "2026-05-22T10:00:00.000Z",
  "lastActivityAt": "2026-05-23T09:00:00.000Z"
}
```

---

### 13.2 `GET /admin/reports/:reportId`

Adds: `description`, `resolution`, `adminNotes`, `reviewHistory`.

---

### 13.3 `POST /admin/reports/:reportId/notes`

Note body → updates `adminNotes` on dispute + review note.

---

### 13.4 `POST /admin/reports/:reportId/escalate`

No body → `status`: `escalated`.

---

### 13.5 `POST /admin/reports/:reportId/resolve`

Reject body (**`reason`** required) → `status`: `resolved`, sets `resolution`, `resolvedAt`.

---

### 13.6 `POST /admin/reports/:reportId/close`

No body → `status`: `closed`.

---

### 13.7 `DELETE /admin/reports/:reportId`

**Super admin only.** Deletes dispute row.

---

## 14. Admin accounts (staff)

Platform moderators — **not** tied to department categories. Use **`POST /admin/departments`** for Joballa categories.

### 14.1 `GET /admin/admins`

| | |
|---|---|
| **Auth** | `admins:manage` + **super admin** |
| **Query** | `page`, `limit`, `search`, `status` (`active` \| `suspended`), `role` (`admin` \| `super_admin`) |

**List item:**

```json
{
  "id": "uuid",
  "name": "Ako James",
  "email": "james@joballa.cm",
  "role": "admin",
  "status": "active",
  "createdAt": "2026-05-01T10:00:00.000Z"
}
```

### 14.2 `POST /admin/admins`

**Body:**

```json
{
  "name": "Ako James",
  "email": "james@joballa.cm",
  "password": "optional-if-sendInvite",
  "role": "admin",
  "sendInvite": true
}
```

**Reject:** `departmentName`, `category`, `departmentId` — use department routes instead.

### 14.3 Staff lifecycle

| Route | Purpose |
|-------|---------|
| `GET /admin/admins/:adminId` | Detail |
| `PATCH /admin/admins/:adminId` | `{ "name?", "role?", "status?" }` |
| `DELETE /admin/admins/:adminId` | Remove staff account |
| `POST .../suspend` | Deactivate |
| `POST .../reactivate` | Activate |
| `POST .../reset-password` | `{ "sent": true, "email": "..." }` |
| `POST .../resend-invite` | `{ "sent": true, "email": "..." }` |

---

## 15. Departments (categories)

Departments are rows in the **`departments`** table (category inbox + optional posting employer). They are **not** staff logins.

### 15.1 `GET /admin/departments`

Paginated. Super admin sees all; scoped moderators see their assigned department when configured.

**Item:**

```json
{
  "id": "uuid",
  "name": "Joballa Domestic",
  "email": "domestic@joballa.cm",
  "admin": "domestic@joballa.cm",
  "slug": "joballa-domestic",
  "category": "domestic",
  "jobs": 214,
  "disputes": 0,
  "status": "active",
  "createdAt": "2026-05-01T10:00:00.000Z",
  "updatedAt": "2026-05-30T12:00:00.000Z"
}
```

`admin` mirrors `email` for legacy UI — not a staff account field.

---

### 15.2 `GET /admin/departments/:departmentId`

```json
{
  "id": "uuid",
  "name": "Joballa Domestic",
  "admin": "domestic@joballa.cm",
  "adminUserId": "uuid",
  "category": "DOMESTIC",
  "jobs": 214,
  "status": "active",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

**Errors:** `404` if outside scope or not found.

---

### 15.3 `POST /admin/departments`

**Super admin only.** Creates a **category** row + optional employer posting account.

**Body:**

```json
{
  "name": "Joballa Domestic",
  "email": "domestic@joballa.cm",
  "slug": "joballa-domestic",
  "description": "House help, cleaning, childcare.",
  "category": "domestic",
  "createEmployerProfile": true
}
```

**Reject:** `password`, `sendInvite` → `400` (create staff via `POST /admin/admins`).

**Processing:** Inserts `departments` row; when `createEmployerProfile` is true (default), creates an `EMPLOYER` user + `employer_profiles` row for job posting and links `employerProfileId`.

---

### 15.4 `PATCH /admin/departments/:departmentId`

**Super admin only.**

```json
{
  "name": "Optional new name",
  "category": "domestic",
  "status": "suspended"
}
```

`status` `suspended` or `deactivated` deactivates the department user account.

---

### 15.5 `DELETE /admin/departments/:departmentId`

**Super admin only.** Deletes the department’s primary user (cascade rules apply).

**Success:** `{ "deleted": true }`

---

### 15.6 `POST /admin/departments/:departmentId/activate`

Sets department + assigned admins `isActive: true`.

---

### 15.7 `POST /admin/departments/:departmentId/suspend`

Sets `isActive: false` for department user and assigned admins.

---

### 15.8 `POST /admin/departments/:departmentId/reactivate`

Same as activate (reactivation path).

---

### 15.9 `POST /admin/departments/:departmentId/employer`

Links or creates the employer posting profile for this category.

**Success:** `{ "employerProfileId": "uuid" }`

**Removed:** `POST /admin/departments/:id/reset-password` — use `POST /admin/admins/:id/reset-password`.

---

### 15.10 `GET /admin/departments/:departmentId/jobs`

Paginated `{ id, title, status }` for jobs on the department’s **posting employer** profile.

---

### 15.11 `GET /admin/departments/:departmentId/documents`

Paginated documents for the department’s **category** (`{ id, user, status }`).

---

### 15.12 `GET /admin/departments/:departmentId/activity`

Recent admin actions (up to 50) related to moderation — **not** filtered strictly by department id in DB query; use for activity feed UI.

---

## 16. Platform users (workers & employers)

**All routes super admin only** (403 for department admin).

### 16.1 `GET /admin/users`

Query: §5.1 + `role=worker|employer`.

**List item:**

```json
{
  "id": "uuid",
  "name": "Esther Mbarga",
  "role": "worker",
  "email": "esther@example.com",
  "status": "active",
  "phone": "+237...",
  "joinedAt": "2026-04-01T10:00:00.000Z",
  "lastActivityAt": "2026-05-22T16:00:00.000Z"
}
```

---

### 16.2 `GET /admin/users/:userId`

Returns user row plus nested `workerProfile` / `employerProfile` (includes recent documents, KYC, applications/jobs).

---

### 16.3 `POST /admin/users/:userId/suspend`

Sets `isActive: false` → returns updated user detail.

---

### 16.4 `POST /admin/users/:userId/reactivate`

Sets `isActive: true`.

---

### 16.5 `DELETE /admin/users/:userId`

Soft-deactivate (`isActive: false`), message `User deactivated.` — does not hard-delete.

---

## 17. Analytics

**Super admin only.**

### 17.1 `GET /admin/analytics/overview`

```json
{
  "totals": [
    { "label": "Total workers", "value": 12840, "note": "" },
    { "label": "Active departments", "value": 6, "note": "" },
    { "label": "Jobs reviewed", "value": 5, "note": "" },
    { "label": "KYC submissions", "value": 6, "note": "" },
    { "label": "Total earnings", "value": "24.8M XAF", "note": "" }
  ],
  "departments": [
    {
      "name": "Joballa Domestic",
      "department": "Domestic",
      "jobs": 214,
      "pending": 16,
      "disputes": 0
    }
  ]
}
```

---

### 17.2 `GET /admin/analytics/departments`

Returns `data` = `departments` array only (same shape as overview’s `departments`).

---

### 17.3 `GET /admin/analytics/earnings`

**Query:** `from`, `to` (optional ISO dates; default from epoch to now).

```json
{
  "from": "1970-01-01T00:00:00.000Z",
  "to": "2026-05-22T12:00:00.000Z",
  "rows": [
    {
      "status": "COMPLETED",
      "totalAmount": 24800000,
      "count": 120
    }
  ]
}
```

---

## 18. Settings

**Super admin only.** Values stored in `platform_settings` table (JSON blobs).

### 18.1 `GET /admin/settings`

Setting area **summaries** (not full config):

```json
[
  {
    "key": "document_requirements",
    "name": "Document requirements",
    "purpose": "Control document types required by user role",
    "access": "Super Admin",
    "status": "active"
  }
]
```

---

### 18.2 `PATCH /admin/settings`

Merges body into **general** settings (same as patch general).

**Default general shape:**

```json
{
  "platformName": "Joballa",
  "supportEmail": "support@joballa.cm",
  "defaultLanguage": "EN"
}
```

---

### 18.3 `GET /admin/settings/moderation`

```json
{
  "autoRejectDuplicates": true,
  "rejectionReasons": [
    "Document is unclear",
    "Job description is incomplete",
    "Selfie is too dark"
  ]
}
```

### 18.4 `PATCH /admin/settings/moderation`

Partial merge of moderation object.

---

### 18.5 `GET /admin/settings/document-requirements`

```json
{
  "worker": ["National ID", "CV"],
  "employer": ["Business registration"]
}
```

### 18.6 `PATCH /admin/settings/document-requirements`

Partial merge.

---

### 18.7 `GET /admin/settings/notifications`

```json
{
  "emailEnabled": true,
  "smsEnabled": false
}
```

### 18.8 `PATCH /admin/settings/notifications`

Partial merge.

---

### 18.9 `GET /admin/settings/department-categories`

Array of category slugs, e.g. `["education","tech","domestic",...]`.

### 18.10 `PATCH /admin/settings/department-categories`

Body: `{ "categories": ["education", "tech", ...] }` (or `value` array alias).

---

## 19. Audit logs

**Super admin only** for platform-wide logs.

### 19.1 `GET /admin/audit-logs`

Paginated platform admin actions.

**Item:**

```json
{
  "id": "uuid",
  "action": "kyc.approve",
  "actorAdminId": "uuid",
  "actor": "admin@joballa.cm",
  "scope": "kyc",
  "entityType": "kyc",
  "entityId": "uuid",
  "oldValues": {},
  "newValues": {},
  "ipAddress": "127.0.0.1",
  "userAgent": "Mozilla/5.0",
  "createdAt": "2026-05-23T12:00:00.000Z"
}
```

---

### 19.2 `GET /admin/audit-logs/:auditLogId`

Single log with `notes`, `metadata`.

---

**Entity-level audit** (KYC/document/job/report): use `GET .../:id/audit-log` on those resources — available to roles with `audit_logs:read` (including department admin for entity drawers).

---

## 20. Status value reference

| Domain | API values |
|--------|------------|
| KYC `status` | `pending`, `approved`, `rejected`, `resubmission_requested` |
| Document `status` | `pending`, `approved`, `rejected`, `resubmission_requested`, `expired` |
| Job `status` | `draft`, `pending_review`, `published`, `suspended`, `closed`, `rejected` |
| Report `status` | `open`, `under_review`, `waiting_for_user`, `escalated`, `resolved`, `closed` |
| User/department `status` | `active`, `suspended` |
| Admin `status` (me) | `active`, `suspended` |

---

## 21. Frontend QA checklist

### Auth & session

- [ ] Login with super admin → `accessToken` + `role: super_admin`
- [ ] Login with department admin → `departmentId` set on `/admin/auth/me`
- [ ] Refresh rotates token when cookie present
- [ ] Logout clears session
- [ ] Non-admin employer/worker login → `403 Not an admin account.`

### Permissions & scoping

- [ ] Department admin receives 403 on `/admin/users`, `/admin/analytics/*`, `/admin/settings/*`
- [ ] UI hides buttons when permission missing even if route exists
- [ ] Document/job lists differ between super admin and department admin

### Moderation flows

- [ ] KYC approve/reject/resubmit with required `reason` on reject paths
- [ ] Document approve/reject; super admin can delete document
- [ ] Job approve → `published`; suspend → `suspended`; restore → `published`
- [ ] Report escalate → resolve (with reason) → close

### Pagination

- [ ] `page` / `limit` query works on all list routes (no 500 on string query params)

### Errors

- [ ] 400 validation shows field messages
- [ ] 409 on duplicate department/admin email
- [ ] 404 on invalid UUID resource

---

## 22. Document history

| Date | Change |
|------|--------|
| May 31, 2026 | Departments/admins split: `GET /admin/admins` + staff CRUD; `departments` table; category create without staff password; `/admin/auth/me` without `departmentId`; jobs `status`/`verifiedOnly` + real `client`; removed department reset-password. |
| May 22, 2026 | Initial frontend guide: all 73 admin routes, auth, envelopes, permissions, errors, QA checklist. |
