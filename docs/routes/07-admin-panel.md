# Admin panel API

Base path: `/admin` (aligned with `docsfromfrontend/adminroutes.md`).

## Response envelope

Success: `{ "success": true, "data": { ... }, "message": "..." }`  
Paginated: `data.items`, `data.page`, `data.limit`, `data.total`, `data.totalPages`  
Errors: Nest standard JSON (`403` for permission failures).

## Auth (`/admin/auth`)

| Method | Path | Access |
|--------|------|--------|
| POST | `/login` | Public |
| POST | `/forgot-password` | Public |
| POST | `/reset-password` | Public |
| POST | `/logout` | Admin JWT |
| POST | `/refresh` | Admin JWT (cookie) |
| GET | `/me` | Admin JWT |
| POST | `/change-password` | Admin JWT |

Login body uses `identifier` + `password` (same as `/auth/login`). Only `ADMIN` / `SUPER_ADMIN` roles succeed.

## Moderation

- `GET /admin/dashboard`
- `GET|POST /admin/kyc` … approve, reject, request-resubmission, notes, audit-log
- `GET|POST /admin/documents` … same pattern + delete (super admin)
- `GET|POST|DELETE /admin/jobs` … approve, reject, suspend, restore, assign-department, notes, audit-log

## Reports (disputes)

- `GET /admin/reports`, `GET /admin/reports/:reportId`
- `POST …/notes`, `escalate`, `resolve`, `close`
- `DELETE …/:reportId` (super admin)

## Departments

Department rows are `EmployerProfile` with `isJoballaDepartment: true`.  
`POST /admin/departments` creates an `ADMIN` user + department profile.

## Super-admin only

- `GET /admin/users` … suspend, reactivate, delete
- `GET /admin/analytics/*`
- `GET|PATCH /admin/settings/*`
- `GET /admin/audit-logs`

## Migration

Apply: `npx prisma migrate deploy` (migration `20260522120000_admin_panel_fields`).

## Roles

- `SUPER_ADMIN`: all permissions, global scope
- `ADMIN`: department-scoped moderation; `User.assignedDepartmentId` → department employer profile id
