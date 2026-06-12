# Worker portal smoke tests

HTTP smoke tests for worker-facing routes (`/api/worker`, `/api/jobs`, `/api/applications`, etc.).

## Quick start

```bash
# Against production (needs credentials or bootstrap)
npm run smoke:worker

# Against local API (dev server on PORT, default 5000)
JOBALLA_WORKER_USE_LOCAL=1 npm run smoke:worker
```

## Auth options

| Mode | Env |
|------|-----|
| Existing worker | `JOBALLA_WORKER_IDENTIFIER` + `JOBALLA_WORKER_PASSWORD` |
| Bearer token | `JOBALLA_WORKER_TOKEN` |
| Seed via DB (Render/local) | `JOBALLA_WORKER_BOOTSTRAP=1` + `DATABASE_URL` / `DIRECT_DB_URL` |
| Local register flow | `JOBALLA_DEV_FIXED_OTP` (six digits, must match server) |

## Suites

| Script | Routes |
|--------|--------|
| `01-session.mjs` | `GET /api/worker/me`, profile, public profile |
| `02-profile.mjs` | Profile PATCH/POST/DELETE (not multipart avatar/KYC upload) |
| `03-jobs.mjs` | Job search, detail, save, hide, report, share |
| `04-saved-jobs.mjs` | Saved jobs list & delete |
| `05-applications.mjs` | Customize, apply, list, detail, archive |
| `06-earnings.mjs` | Summary, transactions, statement |
| `07-engagements.mjs` | List & detail (bootstrap seeds engagement when using `run-all`) |

## Optional fixtures

- `JOBALLA_TEST_JOB_ID`
- `JOBALLA_TEST_APPLICATION_ID`
- `JOBALLA_TEST_ENGAGEMENT_ID`
