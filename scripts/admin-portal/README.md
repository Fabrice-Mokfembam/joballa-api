# Admin portal test scripts

HTTP smoke tests for **`/admin/*`**, grouped by product function (aligned with `docsfromfrontend/adminroutes.md`).

## Prerequisites

1. **API URL** — admin smokes always target **`https://joballa-api.onrender.com`** unless `JOBALLA_ADMIN_USE_LOCAL=1` (then `http://127.0.0.1:$PORT`).
2. **Credentials** (recommended for deployed API):
   - `JOBALLA_ADMIN_IDENTIFIER` + `JOBALLA_ADMIN_PASSWORD` for an existing super admin  
   - Or `JOBALLA_ADMIN_TOKEN` (JWT)
3. **Optional bootstrap** — `DATABASE_URL` + `JOBALLA_ADMIN_BOOTSTRAP=1` seeds a temporary super admin and moderation fixtures via Prisma (must be the **same database** the API uses). Avoid on production unless intentional.

No `JOBALLA_DEV_FIXED_OTP` required for admin login.

## Run everything

```bash
npm run smoke:admin
```

Or:

```bash
node scripts/admin-portal/run-all.mjs
```

## Run by function

| Script | Routes | Notes |
|--------|--------|-------|
| `01-auth.mjs` | login, me, logout, change-password | |
| `02-dashboard.mjs` | dashboard + queue previews | |
| `03-kyc.mjs` | KYC list, detail, approve, notes, audit | |
| `04-documents.mjs` | documents list, detail, approve, notes, audit | |
| `05-jobs.mjs` | jobs moderation, suspend, restore, delete | |
| `06-reports.mjs` | reports/disputes lifecycle | |
| `07-departments.mjs` | departments CRUD + activity | super admin |
| `08-users.mjs` | users list, suspend, reactivate | super admin |
| `09-analytics.mjs` | overview, departments, earnings | super admin |
| `10-settings.mjs` | platform settings | super admin |
| `11-audit-logs.mjs` | audit log list + detail | super admin |

```bash
npm run smoke:admin:kyc
# etc.
```

## Environment variables

```env
# Local API instead of Render:
# JOBALLA_ADMIN_USE_LOCAL=1
# PORT=5000

JOBALLA_ADMIN_IDENTIFIER=superadmin@joballa.cm
JOBALLA_ADMIN_PASSWORD=your-password

# Or reuse a JWT:
# JOBALLA_ADMIN_TOKEN=

# Optional entity IDs when not bootstrapping fixtures
# JOBALLA_TEST_KYC_ID=
# JOBALLA_TEST_DOCUMENT_ID=
# JOBALLA_TEST_JOB_ID=
# JOBALLA_TEST_REPORT_ID=
# JOBALLA_TEST_DEPARTMENT_ID=

# Seed via Prisma (same DATABASE_URL as API) instead of credentials:
# JOBALLA_ADMIN_BOOTSTRAP=1
```

## Response envelope

Admin routes return `{ success, data, message }`. Scripts unwrap `data` automatically in `lib/http.mjs`.
