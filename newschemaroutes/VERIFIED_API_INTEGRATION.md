# Verified API integration (v2)

Last smoke run: **2026-06-04** via `npm run smoke:v2` against `http://127.0.0.1:8000`.

Use the **FRONTEND_*.md** files in this folder as the contracts the frontend should implement against.

## Base URL and auth

| Item | Value |
| --- | --- |
| Local API | `http://127.0.0.1:8000` (or `process.env.NEXT_PUBLIC_API_URL`) |
| Path prefix | **No** `/api` prefix on worker/employer/admin v2 routes |
| Auth header | `Authorization: Bearer <accessToken>` |
| Token source (worker/employer) | `POST /auth/login` or `POST /auth/verify` → `accessToken` |
| Token source (admin) | `POST /admin/auth/login` → `data.accessToken` |
| Session bootstrap | `GET /auth/me` or admin `GET /admin/me` / `GET /admin/dashboard` |
| Refresh | Worker/employer: `POST /auth/refresh` · Admin: `POST /admin/auth/refresh` |

## Route map (verified)

### Auth (`FRONTEND_AUTH_ROUTES.md`)

| Method | Path | Status |
| --- | --- | --- |
| POST | `/auth/register` | Requires `JOBALLA_DEV_FIXED_OTP` in backend `.env` for local OTP |
| POST | `/auth/verify` | Same as above |
| POST | `/auth/resend-otp` | Same as above |
| POST | `/auth/login` | OK |
| GET | `/auth/me` | OK |
| POST | `/auth/refresh` | OK |
| POST | `/auth/logout` | OK |
| POST | `/auth/forgot-password` | OK (always returns generic message) |
| POST | `/auth/reset-password` | Not exercised in smoke (needs OTP) |

Login/register body uses `preferredLanguage`: `"eng"` \| `"fre"` (not `languagePreference`).

**Verify body is only** `{ identifier, code }` (or `otp` instead of `code`). Never resend `role`, `password`, or `preferredLanguage` on `POST /auth/verify` — that causes `400`.

### Worker (`FRONTEND_WORKER_ROUTES.md`)

| Method | Path | Status |
| --- | --- | --- |
| GET | `/worker/me` | OK — use for portal bootstrap |
| GET | `/worker/dashboard` | OK |
| GET | `/worker/jobs` | OK — paginated `{ data, page, limit, total, totalPages }` |
| GET | `/worker/jobs/search` | OK — same handler as `/worker/jobs` |
| GET | `/worker/jobs/:jobId` | OK |
| GET | `/worker/jobs/:jobId/share` | OK |
| POST | `/worker/jobs/:jobId/save` | OK |
| DELETE | `/worker/jobs/:jobId/save` | OK |
| POST | `/worker/jobs/:jobId/hide` | OK |
| DELETE | `/worker/jobs/:jobId/hide` | OK |
| POST | `/worker/jobs/:jobId/report` | OK — body `{ reason: string }` |
| POST | `/worker/jobs/:jobId/apply` | OK — requires `profileCompleteness >= 50` |
| GET | `/worker/saved-jobs` | OK |
| DELETE | `/worker/saved-jobs/:jobId` | OK |
| GET | `/worker/applications` | OK |
| GET | `/worker/applications/search` | OK |
| GET | `/worker/applications/:applicationId` | OK |
| DELETE | `/worker/applications/:applicationId` | OK |
| GET | `/worker/engagements` | OK |
| GET | `/worker/engagements/:engagementId` | OK |
| GET | `/worker/earnings/summary` | OK |
| GET | `/worker/earnings/transactions` | OK |
| GET | `/worker/earnings/transactions/:transactionId` | OK |
| GET | `/worker/earnings/statement` | OK — same data shape as transactions list |
| GET | `/worker/profile` | OK |
| PUT | `/worker/profile` | OK |
| PATCH | `/worker/profile/personal-info` | OK |
| PATCH | `/worker/profile/professional-summary` | OK |
| PATCH | `/worker/profile/skills` | OK |
| POST | `/worker/profile/avatar` | OK — `multipart/form-data`, field `file`, image |
| POST | `/worker/profile/cv` | OK — `multipart/form-data`, field `file`, **PDF only** (uploaded resume) |
| GET | `/worker/profile/cv-export/status` | OK — JSON export metadata |
| POST | `/worker/profile/cv-export` | OK — generates PDF, stores in Cloudinary, returns **PDF binary** (`201`) |
| GET | `/worker/profile/cv-export` | OK — downloads stored generated PDF (**PDF binary**, `200`) |
| POST/PATCH/DELETE | `/worker/profile/work-history/*` | OK |
| POST/PATCH/DELETE | `/worker/profile/education/*` | OK |
| POST/PATCH/DELETE | `/worker/profile/certifications/*` | OK |
| GET/POST/DELETE | `/worker/profile/documents/*` | OK |
| POST/GET | `/worker/profile/kyc` | OK — JSON URLs, not multipart |
| POST/PATCH/DELETE | `/worker/profile/payment-accounts/*` | OK |
| GET/POST | `/worker/informal-requests` | OK |
| GET/PATCH | `/worker/notifications/*` | OK |
| GET/PATCH | `/worker/settings/notifications` | OK |
| PATCH | `/worker/settings/language` | OK — `{ preferredLanguage: "eng" \| "fre" }` |

### Employer (`FRONTEND_EMPLOYER_ROUTES.md`)

| Method | Path | Status |
| --- | --- | --- |
| GET | `/employer/me` | OK — use for portal bootstrap |
| GET | `/employer/dashboard` | OK |
| GET/POST | `/employer/jobs` | OK |
| GET/PATCH/DELETE | `/employer/jobs/:jobId` | OK |
| PATCH | `/employer/jobs/:jobId/status` | OK — `{ status: "draft" \| "active" \| ... }` |
| POST | `/employer/jobs/:jobId/draft` | OK |
| GET | `/employer/applicants/filters` | OK |
| GET | `/employer/applicants` | OK |
| GET | `/employer/applicants/:applicationId` | OK — use **`applicationId`** from list (same as `id`) |
| PATCH | `/employer/applicants/:applicationId/status` | OK — `{ status, note? }` |
| PATCH | `/employer/applicants/:applicationId/notes` | OK — `{ employerNotes: string }` |
| GET | `/employer/applicants/:applicationId/share` | OK |
| GET | `/employer/workforce` | OK |
| GET/PATCH | `/employer/workforce/:workerId` | OK — PATCH requires `{ engagementId, status, reason? }` |
| GET | `/employer/payments` | OK |
| GET | `/employer/payments/workers` | OK |
| POST | `/employer/payments/pay` | OK |
| GET | `/employer/payments/history` | OK |
| GET | `/employer/payments/statement` | OK |
| GET | `/employer/payments/:paymentId` | OK |
| GET/PATCH | `/employer/company` | OK |
| POST | `/employer/company/logo` | OK — multipart `file` |
| POST/DELETE | `/employer/company/documents/*` | OK |
| GET/POST | `/employer/informal-requests` | OK |
| GET/PATCH | `/employer/notifications/*` | OK |
| GET/PATCH | `/employer/settings/*` | OK |

**Not implemented (intentionally removed from v2):**

- `/employer/workforce/:workerId/shifts` (shifts out of scope)

### Admin (`FRONTEND_ADMIN_ROUTES.md`)

| Item | Value |
| --- | --- |
| Base path | `/admin` |
| Login | `POST /admin/auth/login` — `{ identifier, password }` |
| Auth table | `admin_accounts` (not platform `users`) |
| Response | `{ success, data, meta? }` for lists |
| Routes | **55** moderation routes — see full doc |

**Setup:** `npx prisma migrate deploy` then `npm run create:admin -- --email=… --password=… --role=super_admin`

**Smoke-tested:** 58/58 on `https://joballa-api.onrender.com` (June 2026). See **`FRONTEND_ADMIN_ROUTES.md`** for per-route request/response property names.

## Paginated list shape

All list endpoints return:

```ts
{ data: T[]; page: number; limit: number; total: number; totalPages: number }
```

Do **not** expect legacy `items` / `totalCount` fields from `/api/worker` or `/api/employer`.

## Running smoke tests locally

```bash
# Terminal 1
npm run dev

# Terminal 2
API_URL=http://127.0.0.1:8000 npm run smoke:v2
```

Optional: set `JOBALLA_DEV_FIXED_OTP=123456` in `.env` to also smoke register/verify/resend-otp.

Scripts live under `scripts/v2-routes/`.
