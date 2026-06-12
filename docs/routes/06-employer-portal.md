# Employer portal routes — `/api/employer`

Controller: `src/modules/employer-portal/controllers/employer-portal.controller.ts`

**Guards:** `JwtAuthGuard` + `RolesGuard` — **`EMPLOYER`** only.

```http
Authorization: Bearer <access_token>
```

Auth remains at `/auth/*`. Employer portal is namespaced under **`/api/employer`**.

---

## Implemented route index (30 total)

| Function | Count | Base paths |
|----------|------:|------------|
| Session | 1 | `/me` |
| Dashboard | 1 | `/dashboard` |
| Jobs | 7 | `/jobs`, `/jobs/:jobId`, … |
| Applicants | 5 | `/applicants`, … |
| Workforce | 7 | `/workforce`, … |
| Payments | 6 | `/payments`, … |
| Company | 3 | `/company`, `/company/logo` |

---

## Session & dashboard

- `GET /api/employer/me`
- `GET /api/employer/dashboard`

---

## Jobs

| Method | Path |
|--------|------|
| `POST` | `/api/employer/jobs` |
| `GET` | `/api/employer/jobs` |
| `GET` | `/api/employer/jobs/:jobId` |
| `PATCH` | `/api/employer/jobs/:jobId` |
| `PATCH` | `/api/employer/jobs/:jobId/status` |
| `POST` | `/api/employer/jobs/:jobId/draft` |
| `DELETE` | `/api/employer/jobs/:jobId` |

---

## Applicants

| Method | Path |
|--------|------|
| `GET` | `/api/employer/applicants` |
| `GET` | `/api/employer/applicants/filters` |
| `GET` | `/api/employer/applicants/:applicationId` |
| `PATCH` | `/api/employer/applicants/:applicationId/status` |
| `GET` | `/api/employer/applicants/:applicationId/share` |

**Status body:** `{ "status": "shortlisted" | "rejected" | "hired" | "pending" }`  
**Hired** creates a `WorkEngagement` when none exists.

---

## Workforce

| Method | Path |
|--------|------|
| `GET` | `/api/employer/workforce` |
| `GET` | `/api/employer/workforce/:workerId` |
| `GET` | `/api/employer/workforce/:workerId/shifts` |
| `POST` | `/api/employer/workforce/:workerId/shifts` |
| `PATCH` | `/api/employer/workforce/:workerId/shifts/:shiftId` |
| `DELETE` | `/api/employer/workforce/:workerId/shifts/:shiftId` |
| `PATCH` | `/api/employer/workforce/:workerId/status` |

`:workerId` is **`WorkerProfile.id`**.

---

## Payments

| Method | Path |
|--------|------|
| `GET` | `/api/employer/payments` |
| `GET` | `/api/employer/payments/workers` |
| `POST` | `/api/employer/payments/pay` |
| `GET` | `/api/employer/payments/history` |
| `GET` | `/api/employer/payments/:paymentId` |
| `GET` | `/api/employer/payments/statement` |

Query `month` / `year` on summary and workers routes.  
**Pay body:** `workerId`, `amount`, `provider` (`MoMo` | `OM`), `phone`, `period` (`YYYY-MM`).  
Payments are stored as **`PENDING`** until MoMo/Fapshi integration confirms them.

---

## Company

| Method | Path |
|--------|------|
| `GET` | `/api/employer/company` |
| `PATCH` | `/api/employer/company` |
| `POST` | `/api/employer/company/logo` | multipart field **`logo`** |

---

## Schema migrations

1. `20260520120000_employer_job_portal_fields` — job post form columns  
2. `20260520140000_employer_portal_workforce_payments` — `companySize`, `loggedBy`, `payPeriod`, `archivedAt`

Apply with: `npx prisma migrate deploy`
