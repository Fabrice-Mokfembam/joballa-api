# Employer portal test scripts

HTTP smoke tests for **`/api/employer/*`** (30 routes).

## Prerequisites

1. **API** — defaults to **`https://joballa-api.onrender.com`**. Local: `JOBALLA_EMPLOYER_USE_LOCAL=1`.
2. **Auth** (pick one):
   - `JOBALLA_EMPLOYER_IDENTIFIER` + `JOBALLA_EMPLOYER_PASSWORD`
   - `JOBALLA_EMPLOYER_TOKEN`
   - `JOBALLA_EMPLOYER_BOOTSTRAP=1` + `DATABASE_URL` and `DIRECT_DB_URL` (same Neon DB as production API)
   - Local only: `JOBALLA_DEV_FIXED_OTP` (six digits, must match server)

## Run everything

```bash
npm run smoke:employer
```

## Run by function

| Script | Routes |
|--------|--------|
| `01-session.mjs` | `GET /me` |
| `02-dashboard.mjs` | `GET /dashboard` |
| `03-jobs.mjs` | jobs CRUD + status + draft (7) |
| `04-applicants.mjs` | applicants (5) |
| `05-workforce.mjs` | workforce + shifts (7) |
| `06-payments.mjs` | payments (6) |
| `07-company.mjs` | company + logo (3) |

```bash
npm run smoke:employer:jobs
```

## Environment variables

```env
# JOBALLA_EMPLOYER_USE_LOCAL=1
# JOBALLA_EMPLOYER_IDENTIFIER=
# JOBALLA_EMPLOYER_PASSWORD=
# JOBALLA_EMPLOYER_BOOTSTRAP=1
# DIRECT_DB_URL=   # preferred for Prisma seeding on Neon
```

## Frontend docs

See **`helperdocs/FRONTEND_EMPLOYER_PORTAL_API_GUIDE_MAY_2026.md`**.

## Skip logo upload

```bash
SKIP_LOGO_UPLOAD=1 npm run smoke:employer:company
```
