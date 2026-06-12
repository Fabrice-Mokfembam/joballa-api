# Backend Response: Employer Departments — Seed + List API

**Date:** 2026-06-07  
**To:** Joballa web frontend (`joballa-web-copy`)  
**Status:** Implemented  
**Route:** `GET /employer/departments`

---

## Summary

Eight **canonical departments** (one per `department_category`) are seeded with **stable UUIDs**. Employers can list them via **`GET /employer/departments`** to map UI category → `departmentId` for `POST /employer/jobs`.

---

## Seed

Run locally or on deploy:

```bash
npm run seed:departments
```

- Upserts by **`slug`** (idempotent)
- Preserves **`ae761000-7002-4136-bf74-e5aabe5ae799`** for existing jobs (legacy `integration-smoke` → `software-tech`)
- Deactivates non-canonical department rows (`isActive: false`)

### Canonical rows

| `category` | `slug` | `id` |
| --- | --- | --- |
| `education` | `education` | `11111111-1111-4111-8111-111111110001` |
| `domestic` | `domestic` | `11111111-1111-4111-8111-111111110002` |
| `logistics` | `logistics` | `11111111-1111-4111-8111-111111110003` |
| `events` | `events` | `11111111-1111-4111-8111-111111110004` |
| `agriculture` | `agriculture` | `11111111-1111-4111-8111-111111110005` |
| `construction` | `construction` | `11111111-1111-4111-8111-111111110006` |
| `software_tech` | `software-tech` | `ae761000-7002-4136-bf74-e5aabe5ae799` |
| `other` | `other` | `11111111-1111-4111-8111-111111110099` |

Data source: `prisma/departments-seed-data.mjs`  
Script: `scripts/seed-departments.mjs`

---

## API: `GET /employer/departments`

**Auth:** employer bearer token

### Query params

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `isActive` | `boolean` | `true` | Set `false` to include inactive rows |
| `category` | `string` | — | Filter, e.g. `education`, `software_tech` |

### Response `200`

```json
{
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111110001",
      "name": "Education",
      "slug": "education",
      "category": "education",
      "isActive": true
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 50
}
```

### Errors

| HTTP | When |
| --- | --- |
| `401` | Missing/invalid token |
| `403` | Not an employer |

---

## Frontend usage

1. On post-job / edit-job load: `GET /employer/departments`
2. Build map: `category` → `id`
3. Category **Education** → `departmentId` where `category === "education"`
4. **Other** → `departmentId` for `category === "other"`

You can remove `NEXT_PUBLIC_JOB_DEPARTMENTS_JSON` fallback once this is deployed and seeded.

---

## Verification

- [x] `GET /employer/departments` returns active canonical rows
- [x] Each category slug present (`software_tech`, `other`, …)
- [x] `ae761000-7002-4136-bf74-e5aabe5ae799` retained for `software_tech`
- [x] Smoke: `scripts/v2-routes/03-employer.mjs`

---

## Related

- [EMPLOYER_JOB_POSTING_GUIDE.md](./EMPLOYER_JOB_POSTING_GUIDE.md)
- [FRONTEND_EMPLOYER_ROUTES.md](./FRONTEND_EMPLOYER_ROUTES.md)
