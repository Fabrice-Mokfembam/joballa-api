# Worker profile routes — `/worker-profiles`

Controller: `src/modules/worker-profiles/controllers/worker-profiles.controller.ts`

**Guards:** `JwtAuthGuard` + `RolesGuard` — only **`WORKER`** users.

All endpoints require:

```http
Authorization: Bearer <access_token>
```

---

## `GET /worker-profiles/me`

Returns the authenticated worker’s profile aggregate (service-defined shape).

**Success:** **200** — JSON profile object owned by `WorkerProfilesService`.

**Errors:** **401** (no/invalid token); **403** (non-worker).

---

## `PATCH /worker-profiles/me`

Partial update; all fields optional.

**Body (optional fields)**

| Field | Type / validation |
| --- | --- |
| `fullName` | string, max 120 |
| `city` | string \| null, max 120 |
| `region` | string \| null, max 120 |
| `dateOfBirth` | ISO date string \| null (`@IsDateString`) |
| `bio` | string \| null |
| `preferredJobCategories` | string[] |
| `languagesSpoken` | string[] |
| `availabilityStatus` | enum `AvailabilityStatus` |
| `skills` | string[] |
| `workHistory` | array of objects |
| `education` | array of objects |
| `nationalIdDocUrl` | URL string \| null |
| `uploadedResumeUrl` | URL string \| null |
| `mobileMoneyProvider` | enum `MomoProvider` \| null |
| `mobileMoneyNumber` | string \| null, max 40 |

**Success:** **200** — updated profile payload from  service.

**Errors:** **400** validation; **401** / **403**.
