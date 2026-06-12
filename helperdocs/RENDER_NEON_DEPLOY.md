# Render deploy with Neon PostgreSQL

## Problem (P1002 advisory lock)

If deploy logs show:

```text
Datasource "db": ... at "...-pooler....neon.tech"
Error: P1002 ... Timed out trying to acquire a postgres advisory lock
```

`prisma migrate deploy` is using the **pooler** URL. Migrations need a **direct** connection.

## Required Render environment variables

Set both in the Render service **Environment** tab:

| Variable | Neon console | Used by |
|----------|--------------|---------|
| `DATABASE_URL` | **Pooled** connection (`-pooler` in hostname) | Running app (`PrismaService`) |
| `DIRECT_DB_URL` | **Direct** connection (no `-pooler`) | `prisma migrate deploy` (optional if `DATABASE_URL` is a standard Neon pooler URL — `prisma.config.ts` strips `-pooler` from the hostname automatically) |

Example hostnames:

- Pooler: `ep-xxxx-pooler.c-6.us-east-1.aws.neon.tech`
- Direct: `ep-xxxx.c-6.us-east-1.aws.neon.tech`

Copy both strings from [Neon Console](https://console.neon.tech) → your project → **Connect**.

Also set (unchanged): `JWT_SECRET`, `PORT` (Render sets `PORT` automatically), `CORS_ORIGINS`, Cloudinary keys, etc.

## Local development

If you see `Connection terminated unexpectedly` on login/API calls:

1. Set **`DIRECT_DB_URL`** in `.env` to the Neon **direct** connection (hostname **without** `-pooler`).
2. Keep **`DATABASE_URL`** as the pooler URL (optional locally; used in production).
3. In development, the app prefers `DIRECT_DB_URL` automatically for a stable `pg` pool.

Wake a sleeping Neon branch (run any query in the Neon SQL editor) if the first request after idle takes ~20s and fails.

## Start command (recommended)

```bash
sh scripts/render-start.sh
```

Or keep:

```bash
npx prisma migrate deploy && node dist/main.js
```

after `DIRECT_DB_URL` is configured.

## Build command (unchanged)

```bash
npm install && npx prisma generate && npx nest build
```

`prisma generate` does **not** need `DIRECT_DB_URL` (it does not connect to the DB).  
`DIRECT_DB_URL` is required when the **start command** runs `prisma migrate deploy`.

## Overlapping deploys

Two deploys at once can both run `migrate deploy` and fight for the advisory lock. Wait for one deploy to finish, or redeploy once.

## Verify

After setting `DIRECT_DB_URL`, redeploy. Logs should show:

```text
Datasource "db": ... at "ep-xxxx.c-6.us-east-1.aws.neon.tech"
```
(without `-pooler`)

Then:

```text
No pending migrations to apply.
```

and the app should bind to `PORT` and pass health checks.
