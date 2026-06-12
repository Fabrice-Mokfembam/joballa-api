# Employer Job Posting — Complete API Guide

**Date:** 2026-06-07  
**Audience:** Frontend (employer portal — post job, edit job, draft)  
**Routes:** `POST /employer/jobs`, `PATCH /employer/jobs/:jobId`, `GET /employer/jobs/:jobId`

---

## Overview

Employers create and update **standard jobs** (listed on the worker marketplace) via JSON bodies. The same field set is used for:

| Action | Method | Route |
| --- | --- | --- |
| Create / publish | `POST` | `/employer/jobs` |
| Update content | `PATCH` | `/employer/jobs/:jobId` |
| Save draft on existing job | `POST` | `/employer/jobs/:jobId/draft` |
| Change lifecycle status | `PATCH` | `/employer/jobs/:jobId/status` |
| Read for edit prefill | `GET` | `/employer/jobs/:jobId` |

**Status is never set on create/update body** — use the status route. Display **Active** in UI for API value `active` (not `live`).

---

## Your recent error (500 → now 400)

From `POST /employer/jobs`:

| Problem | What was sent | What backend expects |
| --- | --- | --- |
| **`departmentId`** | `"SALES"` | **UUID** from `departments` table, e.g. `"ae761000-7002-4136-bf74-e5aabe5ae799"` |
| **`startDate`** | Invalid date string → `Invalid Date` | **ISO date** `YYYY-MM-DD`, or **omit** when `startNow: true` |

Sending `"SALES"` or a bad date previously caused a **500**; the API now returns **400** with a clear `message`.

---

## TypeScript contract

### Request — create (`CreateEmployerJobRequest`)

```ts
type CreateEmployerJobRequest = {
  /** Required — department UUID, NOT slug/name/code */
  departmentId: string;

  /** Required for publish — non-empty recommended */
  title: string;

  /** Required — see enum table below */
  employmentType:
    | "full_time"
    | "part_time"
    | "contract"
    | "casual"
    | "seasonal"
    | "internship";

  /** Optional — default "onsite" */
  workMode?: "onsite" | "remote" | "hybrid";

  /** Optional — default "Cameroon" */
  country?: string;
  region?: string;

  /** Required — city name */
  city: string;
  neighbourhood?: string;

  /** Required — integer (FCFA amount) */
  payAmount: number;

  /** Optional — default "XAF" */
  payCurrency?: "XAF";

  /** Required */
  payStructure: "hourly" | "daily" | "weekly" | "monthly" | "fixed";

  /** Optional */
  experienceLevel?:
    | "entry"
    | "junior"
    | "mid"
    | "senior"
    | "lead"
    | "tutor"
    | "not_required";

  /**
   * Optional start date — ISO calendar date only.
   * Omit when startNow is true.
   * Do NOT send empty string or locale strings like "07/06/2026".
   */
  startDate?: string | null;

  /** If true, worker can start immediately — omit startDate */
  startNow: boolean;

  /** Free-text contract length, e.g. "1 month", "6 months", "Permanent" */
  duration?: string;

  /** Required for publish — job description (plain text) */
  description: string;

  /** Bullet lists — each item one string */
  requirements: string[];
  responsibilities: string[];
  requiredSkills: string[];

  /** Optional — documents workers should attach when applying */
  requestedDocuments?: Array<Record<string, unknown>>;

  /** Default 1 */
  numberOfOpenings: number;

  /** Joballa handles worker payments when true */
  paymentManagedByJoballa?: boolean;

  /** true → status draft; false/omit → status under_review (admin approval required) */
  asDraft?: boolean;
};
```

### Request — update (`UpdateEmployerJobRequest`)

```ts
type UpdateEmployerJobRequest = Partial<CreateEmployerJobRequest>;
// Do not send `asDraft` on PATCH — use POST …/draft or status route.
```

### Response — create (`CreateEmployerJobResponse`)

```ts
type CreateEmployerJobResponse = {
  jobId: string;
  status: "draft" | "under_review" | "active" | "paused" | "closed" | "rejected";
  submissionScore?: {
    score: number;
    tier: "auto_approved" | "yellow_zone" | "flagged" | "auto_rejected";
  };
  rejectionReason?: string | null;
  changeRequest?: string | null;
  message: string;
};
```

### Response — get / patch (`EmployerJobDetail`)

Same shape returned by `GET` and `PATCH`:

```ts
type EmployerJobDetail = {
  id: string;
  title: string;
  departmentId: string;
  department: {
    id: string;
    name: string;
    slug: string;
    category: string; // e.g. "software_tech", "education"
  } | null;

  city: string;
  region?: string | null;
  country: string;
  neighbourhood?: string | null;

  employmentType: string;
  workMode: string;
  experienceLevel?: string | null;

  payAmount: number;
  payCurrency: string;
  payStructure: string;

  duration?: string | null;
  startDate?: string | null; // "YYYY-MM-DD"
  startNow: boolean;

  description: string;
  requirements: string[];
  responsibilities: string[];
  requiredSkills: string[];
  requestedDocuments?: unknown[];
  numberOfOpenings: number;

  paymentManagedByJoballa: boolean;
  status: string;
  applicantsCount: number;
  shortlistedCount: number;
  hiredCount: number;
  submissionTier?: string | null;
  rejectionReason?: string | null;
  changeRequest?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  adminNotes?: string | null;
};
```

---

## Field reference (every property)

| Field | Type | Required on POST | Default | Notes |
| --- | --- | --- | --- | --- |
| `departmentId` | `string` (UUID) | **Yes** | — | FK to `departments.id`. **Never** slug (`sales`), name, or category code. |
| `title` | `string` | Yes* | `""` | Job title shown to workers. |
| `employmentType` | enum | **Yes** | — | Lowercase snake_case in JSON. |
| `workMode` | enum | No | `onsite` | |
| `country` | `string` | No | `"Cameroon"` | |
| `region` | `string` | No | `null` | e.g. `"Littoral"`, `"Centre"` |
| `city` | `string` | Yes* | `""` | |
| `neighbourhood` | `string` | No | `null` | |
| `payAmount` | `number` | Yes* | `0` | Integer; stored as Int in DB. |
| `payCurrency` | `string` | No | `"XAF"` | |
| `payStructure` | enum | **Yes** | — | How pay is quoted. |
| `experienceLevel` | enum | No | `null` | |
| `startDate` | `string` | No | `null` | **`YYYY-MM-DD` only**. Omit if `startNow`. |
| `startNow` | `boolean` | Yes | `false` | When `true`, do not send `startDate`. |
| `duration` | `string` | No | `null` | Single string, not split fields. |
| `description` | `string` | Yes* | `""` | Long text. |
| `requirements` | `string[]` | No | `[]` | |
| `responsibilities` | `string[]` | No | `[]` | |
| `requiredSkills` | `string[]` | No | `[]` | Used for applicant skill matching. |
| `requestedDocuments` | `object[]` | No | `[]` | Opaque JSON; structure TBD. |
| `numberOfOpenings` | `number` | No | `1` | Positions to fill. |
| `paymentManagedByJoballa` | `boolean` | No | `false` | |
| `asDraft` | `boolean` | No | `false` | `true` → `draft`; `false` → **`under_review`**. |

\*Backend accepts empty strings/zeros today; validate on the client before publish.

---

## Enum values (send lowercase in JSON)

Backend normalises with `.toUpperCase()` internally. Always send **lowercase** API values:

### `employmentType`

| API value | Meaning |
| --- | --- |
| `full_time` | Full-time |
| `part_time` | Part-time |
| `contract` | Fixed-term contract |
| `casual` | Casual |
| `seasonal` | Seasonal |
| `internship` | Internship |

### `workMode`

| API value |
| --- |
| `onsite` |
| `remote` |
| `hybrid` |

### `payStructure`

| API value |
| --- |
| `hourly` |
| `daily` |
| `weekly` |
| `monthly` |
| `fixed` |

### `experienceLevel`

| API value |
| --- |
| `entry` |
| `junior` |
| `mid` |
| `senior` |
| `lead` |
| `tutor` |
| `not_required` |

### `status` (read-only on create; set via status route)

| API value | UI label suggestion |
| --- | --- |
| `draft` | Draft |
| `under_review` | Under review |
| `active` | **Active** |
| `paused` | Paused |
| `closed` | Closed |
| `rejected` | Rejected |

---

## `departmentId` — critical

Departments live in the `departments` table:

```ts
type Department = {
  id: string;       // ← use this as departmentId
  name: string;     // display only
  slug: string;     // URL-safe — NOT departmentId
  category: string; // e.g. software_tech, education
  isActive: boolean;
};
```

**Correct**

```json
"departmentId": "11111111-1111-4111-8111-111111110001"
```

**Wrong**

```json
"departmentId": "SALES"
"departmentId": "education"
"departmentId": "software_tech"
```

Load departments via **`GET /employer/departments`**. Seed all categories: `npm run seed:departments`. See [BACKEND_RESPONSE_EMPLOYER_DEPARTMENTS.md](./BACKEND_RESPONSE_EMPLOYER_DEPARTMENTS.md).

---

## `startDate` and `startNow`

| Scenario | Send |
| --- | --- |
| Start immediately | `{ "startNow": true }` — **omit** `startDate` |
| Start on a date | `{ "startNow": false, "startDate": "2026-07-15" }` |
| Draft, date TBD | `{ "startNow": false }` — omit `startDate` |

**Valid date format:** ISO 8601 **date** only: `"YYYY-MM-DD"`.

**Invalid (will 400):**

- `""` (empty string)
- `"Invalid Date"`
- `"07/06/2026"` (locale format — parse on client first)
- `"2026-13-40"` (invalid calendar date)

**Client helper (recommended):**

```ts
function toApiStartDate(value: Date | null | undefined): string | undefined {
  if (!value || Number.isNaN(value.getTime())) return undefined;
  return value.toISOString().slice(0, 10);
}
```

When `startNow` is checked in the form, **delete** `startDate` from the payload before POST/PATCH.

---

## `duration`

Single free-text field stored as-is. Examples:

- `"1 month"`
- `"3 months"`
- `"6 months"`
- `"Permanent"`
- `"Until project completion"`

There is **no** `durationValue` / `durationUnit` split on the API. Combine on the client when building the request; split when parsing GET if your UI uses two controls.

---

## Example — valid create (publish)

```http
POST /employer/jobs
Authorization: Bearer <employer token>
Content-Type: application/json
```

```json
{
  "departmentId": "ae761000-7002-4136-bf74-e5aabe5ae799",
  "title": "Sales Engineer",
  "employmentType": "full_time",
  "workMode": "onsite",
  "country": "Cameroon",
  "region": "Littoral",
  "city": "Douala",
  "payAmount": 60000,
  "payCurrency": "XAF",
  "payStructure": "monthly",
  "experienceLevel": "mid",
  "startNow": true,
  "duration": "1 month",
  "description": "Results-driven sales professional…",
  "requirements": [
    "High school diploma or equivalent.",
    "Strong communication and interpersonal skills."
  ],
  "responsibilities": [
    "Identify and approach potential customers",
    "Meet or exceed sales targets."
  ],
  "requiredSkills": ["Sales", "Communication"],
  "numberOfOpenings": 5,
  "paymentManagedByJoballa": true,
  "asDraft": false
}
```

**Response `200`**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "under_review",
  "submissionScore": { "score": 90, "tier": "auto_approved" },
  "rejectionReason": null,
  "changeRequest": null,
  "message": "Job submitted. Joballa admin will review before going live."
}
```

After **`PATCH /admin/jobs/:id/approve`**, status becomes **`active`** and the job appears on the worker feed.

---

## Example — save draft

```json
{
  "departmentId": "ae761000-7002-4136-bf74-e5aabe5ae799",
  "title": "Draft title",
  "employmentType": "full_time",
  "workMode": "onsite",
  "city": "Douala",
  "payAmount": 50000,
  "payStructure": "monthly",
  "startNow": false,
  "description": "Work in progress…",
  "requirements": [],
  "responsibilities": [],
  "requiredSkills": [],
  "numberOfOpenings": 1,
  "asDraft": true
}
```

---

## Arrays (`requirements`, `responsibilities`, `requiredSkills`)

- Always send **JSON arrays of strings**, even when empty: `"requirements": []`
- Do not send a single multiline string unless you split it client-side
- Empty strings in arrays are stored as-is; trim on client

---

## Error responses

| HTTP | When |
| --- | --- |
| `400` | Invalid enum, bad `departmentId`, bad `startDate`, missing required enum |
| `401` | Missing/invalid token |
| `403` | Not an employer |
| `404` | Job not found (update/get) |

**Shape**

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Invalid startDate. Use ISO date YYYY-MM-DD, or omit startDate when startNow is true.",
  "path": "/employer/jobs",
  "timestamp": "2026-06-07T13:10:10.266Z"
}
```

Field-level 422 maps are **not** implemented — show `message` in a toast or banner.

---

## Frontend mapper checklist

Before `POST /employer/jobs` or `PATCH /employer/jobs/:jobId`:

1. **`departmentId`** = selected department **`id`** (UUID), not label/slug/category.
2. **`startNow === true`** → remove `startDate` from body.
3. **`startDate`** → `YYYY-MM-DD` or omit; never send invalid/empty string.
4. **Enums** → lowercase (`full_time`, not `FULL_TIME` or `Full Time`).
5. **`payAmount`** → number, not string `"60000"`.
6. **Lists** → `string[]` for requirements, responsibilities, requiredSkills.
7. **`duration`** → one string if using duration picker.
8. **Status** → only on `PATCH …/status`, not on job body.
9. **`live`** → map to **`active`** before status PATCH.

---

## Related docs

- [BACKEND_RESPONSE_EMPLOYER_JOB_EDIT.md](./BACKEND_RESPONSE_EMPLOYER_JOB_EDIT.md) — edit flow, PATCH response, active job rules
- [BACKEND_RESPONSE_EMPLOYER_JOB_MODERATION.md](./BACKEND_RESPONSE_EMPLOYER_JOB_MODERATION.md) — submit → `under_review`, admin approve
- [FRONTEND_EMPLOYER_ROUTES.md](./FRONTEND_EMPLOYER_ROUTES.md) — full employer route index

---

## Database reference (Prisma)

For backend developers — `Job` model columns map 1:1 to API fields above. Notable DB types:

| Column | DB type |
| --- | --- |
| `payAmount` | `Int` |
| `startDate` | `Date` (date only) |
| `requirements`, `responsibilities`, `requiredSkills` | `String[]` |
| `requestedDocuments` | `Json` |
| `departmentId` | `Uuid` → `departments.id` |
