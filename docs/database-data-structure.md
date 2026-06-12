# Joballa Backend Database Data Structure

**Source of truth:** `prisma/schema.prisma`  
**Last schema sync:** May 31, 2026

| Migration | Purpose |
|-----------|---------|
| `20260531140000_align_data_structure_doc` | Worker/employer portal fields, `worker_payment_accounts`, job worker creator, application extras |
| `20260531180000_departments_and_audit_fields` | `departments` table, `employer_profiles.departmentId`, `admin_actions.scope` / `entityLabel` |

This document explains how data is stored in the Joballa backend database. The backend uses Prisma with PostgreSQL; each model maps to a table via `@@map(...)`.

**For the admin panel team:** Section [**Admin panel backend handoff (May 2026)**](#admin-panel-backend-handoff-may-2026) lists schema changes and API contracts requested by `joballa-admin`.

---

## Storage overview

- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma — `prisma/schema.prisma`
- **Migrations:** `prisma/migrations/`
- **IDs:** UUID (most tables), CUID (`otp_codes`, `refresh_tokens`)
- **Money:** `Decimal(12, 2)`; **files:** URL strings (Cloudinary)

## Core data flow

1. `users` — account identity  
2. `worker_profiles` or `employer_profiles` (or admin without profile)  
3. Employers/workers create `jobs`  
4. Workers `applications` with `profileSnapshot` JSON  
5. Hire → `work_engagements` → `shift_logs`, `payments`  
6. Admin: `departments`, `admin_actions`, `admin_review_notes`, moderation on jobs/KYC/documents  

## Enums

All enums are defined in `prisma/schema.prisma` (`Role`, `JobStatus`, `ApplicationStatus`, `DepartmentCategory`, `JobCreatedByType`, `DepartmentStatus`, etc.). See schema file for the full list.

## Tables (Prisma models)

| Model | Table | Notes |
|-------|-------|--------|
| `User` | `users` | `assignedDepartmentId` legacy — null for `ADMIN`/`SUPER_ADMIN` after migration |
| `WorkerProfile` | `worker_profiles` | Includes `profileStrengthBreakdown`, `profileViews`, `avatarUrl` |
| `WorkerPaymentAccount` | `worker_payment_accounts` | Multiple MoMo accounts per worker |
| `WorkHistory` | `work_histories` | Normalized CV history |
| `Education` | `educations` | |
| `Certification` | `certifications` | Optional `documentId` → `worker_documents` |
| `WorkerDocument` | `worker_documents` | CV, certificates, admin review |
| `KYCSubmission` | `kyc_submissions` | Includes `selfieImageUrl` |
| **`Department`** | **`departments`** | **NEW** — Joballa category (not staff login) |
| `EmployerProfile` | `employer_profiles` | `tagline`, `about`, optional `departmentId` |
| `Job` | `jobs` | `createdByType`, `createdByWorkerId`, `workMode` |
| `Application` | `applications` | `employerNotes`, `matchPercent`, archive fields |
| `WorkEngagement` | `work_engagements` | `roleLabel` |
| `Payment` | `payments` | Fapshi fields, `receiptNumber`, `completedAt` |
| `Notification` | `notifications` | In-app / email / SMS |
| `AdminAction` | `admin_actions` | **`scope`**, **`entityLabel`** for platform logs UI |

Detailed column lists: open `prisma/schema.prisma` or generate ERD from Prisma Studio.

### `departments` (new)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID | Primary key; backfill uses `employer_profiles.id` for existing Joballa departments |
| `name` | String | Display name |
| `slug` | String | Unique URL slug |
| `email` | String | Category contact inbox (not staff login) |
| `category` | `DepartmentCategory` | education, tech, domestic, … |
| `description` | Text? | Optional |
| `employerProfileId` | UUID? | FK → posting `employer_profiles` row |
| `status` | `DepartmentStatus` | `ACTIVE`, `SUSPENDED` |

**Not stored here:** staff passwords, pending moderation counts.

### `employer_profiles` (additions)

| Column | Notes |
|--------|--------|
| `tagline` | Short public line |
| `about` | Long bio (API may alias as `bio`) |
| `departmentId` | FK → `departments.id` when Joballa-owned |

### `admin_actions` (additions)

| Column | Notes |
|--------|--------|
| `scope` | Product **Area** (Jobs, KYC, …) — not a raw DB id |
| `entityLabel` | Human-readable **Entity** column at write time |

## Design notes

- **Applications** store `profileSnapshot` JSON at submit time.  
- **Employer company:** `tagline` + `about`; `applicantsCount` / `employeesCount` are API aggregates, not columns.  
- **Worker-created jobs:** `jobs.createdByWorkerId` + `createdByType = WORKER`.  
- **Departments vs employer profiles:** Categories live in `departments`; posting account remains `employer_profiles` linked via `employerProfileId`.

---

## Admin panel backend handoff (May 2026)

**Audience:** Backend / API team  
**From:** `joballa-admin` frontend  

### Priority summary

| Priority | Area | Status |
|----------|------|--------|
| **P0** | `departments` table | **Schema added** — wire `/admin/departments` to `Department` model |
| **P0** | `GET /admin/admins` | Route work (schema ready) |
| **P0** | Audit `entityLabel` + `scope` | **Columns added** — populate on every `logAction` |
| **P0** | Jobs `client` name | API mapping (no schema change) |
| **P1** | Null `users.assignedDepartmentId` for admins | **Migration applied** |

### A. Database changes

#### A1. `departments` — implemented in Prisma

See model `Department` in `prisma/schema.prisma`.

#### A2. `users.assignedDepartmentId`

Deprecated for `ADMIN` / `SUPER_ADMIN`. Migration sets these to `NULL`.

#### A3. `employer_profiles.departmentId`

Optional FK → `departments.id` for Joballa department employers.

#### A4. `admin_actions.entityLabel` + `scope`

Implemented. Update `AdminAuditService.logAction(..., { scope, entityLabel })` on all admin mutations.

### E. Migration path (backend)

1. ~~Create `departments` table~~ — done  
2. Backfill from `employer_profiles` where `isJoballaDepartment = true` — done in SQL migration  
3. ~~Set `assignedDepartmentId = null` for platform admins~~ — done  
4. Implement admin APIs against `Department` instead of conflating with `EmployerProfile` only  
5. Write `entityLabel` on all audit rows  

### Related docs

- `helperdocs/FRONTEND_ADMIN_PANEL_API_GUIDE_MAY_2026.md`  
- `helperdocs/FRONTEND_EMPLOYER_PORTAL_API_GUIDE_MAY_2026.md`  
- `helperdocs/FRONTEND_WORKER_PORTAL_API_GUIDE_MAY_2026.md`  
- `docsfromfrontend/EMPLOYER_ROUTES_COMPREHENSIVE.md`  

---

*When changing storage, update `prisma/schema.prisma`, run `npx prisma migrate dev`, then refresh this file if contracts change.*
