# Employer profile routes — `/employer-profiles`

Controller: `src/modules/employer-profiles/controllers/employer-profiles.controller.ts`

**Guards:** `JwtAuthGuard` + `RolesGuard` — only **`EMPLOYER`** users.

All endpoints require:

```http
Authorization: Bearer <access_token>
```

---

## `GET /employer-profiles/me`

Returns the authenticated employer’s profile aggregate.

**Success:** **200** — JSON profile object from `EmployerProfilesService`.

**Errors:** **401** / **403**.

---

## `PATCH /employer-profiles/me`

Partial update; all fields optional.

**Body (optional fields)**

| Field | Type / validation |
| --- | --- |
| `companyName` | string, max 160 |
| `industry` | string \| null, max 160 |
| `location` | string \| null, max 160 |
| `logoUrl` | URL string \| null |
| `website` | URL string \| null |
| `about` | string \| null |
| `businessRegDocUrl` | URL string \| null |
| `paymentProvider` | enum `MomoProvider` \| null |
| `paymentAccount` | string \| null, max 120 |

**Success:** **200** — updated profile payload.

**Errors:** **400** validation; **401** / **403**.
