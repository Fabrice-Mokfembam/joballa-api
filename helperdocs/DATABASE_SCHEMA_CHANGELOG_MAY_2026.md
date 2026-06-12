# Database schema changelog (May 31, 2026)

**Source of truth:** `prisma/schema.prisma`  
**Full data dictionary:** use the team doc *Joballa Backend Database Data Structure* (synced with this migration).

Migration: `prisma/migrations/20260531140000_align_data_structure_doc/`

## New

| Item | Description |
|------|-------------|
| `JobCreatedByType` enum | `EMPLOYER`, `WORKER` |
| `worker_payment_accounts` table | Multiple MoMo payout accounts per worker (`provider`, `phone`, `isPrimary`) |

## Added columns

| Table | Columns |
|-------|---------|
| `worker_profiles` | `avatarUrl`, `profileStrengthBreakdown`, `profileViews` |
| `work_histories` | `website`, `city`, `region`, `startMonth`, `startYear`, `endMonth`, `endYear` |
| `educations` | `website`, `city`, `region`, `description`, `startMonth`, `startYear`, `endMonth`, `endYear` |
| `certifications` | `description`, `credentialUrl`, `documentId` (FK → `worker_documents`) |
| `kyc_submissions` | `selfieImageUrl` |
| `employer_profiles` | `tagline` |
| `jobs` | `createdByWorkerId`, `createdByType`, `region` |
| `applications` | `matchPercent`, `lastStatusMessage`, `interviewAt`, `offerValidUntil`, `archivedByWorkerAt` |
| `work_engagements` | `roleLabel` |
| `payments` | `paymentPlatform`, `paymentMethod`, `receiptNumber`, `completedAt` |

## Deploy

```bash
npx prisma migrate deploy
```

On Render this runs at startup. Existing rows keep defaults (`createdByType = EMPLOYER`, `profileViews = 0`).

## Not in DB (computed in API)

- Employer `applicantsCount`, `employeesCount`
- Application job title with location suffix (return `title` + `city`/`region` separately)
