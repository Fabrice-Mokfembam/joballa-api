# Backend Response: Employer Job Edit (`PATCH /employer/jobs/:jobId`)

**Date:** 2026-06-07  
**To:** Joballa web frontend (employer portal)  
**Status:** Confirmed — GET detail fields added for edit prefill  
**Routes:** `GET /employer/jobs/:jobId`, `PATCH /employer/jobs/:jobId`, `PATCH /employer/jobs/:jobId/status`

---

## Summary

Job edit is **supported for all owned jobs**, including **`active`**. Content fields are not locked by status. Status changes stay on the dedicated status route. `PATCH` returns the full **`EmployerJobDetail`** (same shape as `GET`). Edits to active jobs **do not** currently re-trigger moderation or change `status`.

---

## 1. Editable while active

| Question | Answer |
| --- | --- |
| Can employers edit an **active** job? | **Yes** — title, description, pay, location, skills, requirements, etc. |
| Fields locked by status? | **None** — any field accepted on `PATCH` can be updated regardless of `draft`, `active`, `paused`, `closed`, `under_review`, or `rejected`. |
| Status on content PATCH? | **Ignored** — use `PATCH /employer/jobs/:jobId/status` only. Sending `{ status: "active" }` on the job body has no effect. |
| API accepts `live`? | **No** — use `active`. Frontend mapping `live` → `active` is correct. |

**Recommendation:** Keep status actions in the ⋯ menu on `PATCH …/status` only (matches current UI plan).

---

## 2. GET detail completeness (edit prefill)

`GET /employer/jobs/:jobId` returns **`EmployerJobDetail`**. Fields relevant to the edit form:

| Field | In response | Notes |
| --- | --- | --- |
| `departmentId` | **Yes** | UUID — round-trip on `PATCH` |
| `department` | Yes | `{ id, name, slug, category }` — use `departmentId` or `department.id` |
| `title`, `description` | Yes | |
| `workMode`, `employmentType` | Yes | Lowercase API values (`onsite`, `full_time`, …) |
| `experienceLevel` | **Yes** | e.g. `entry`, `junior`, `mid`, `senior`, `lead`, `tutor`, `not_required`, or `null` |
| `country`, `region`, `city`, `neighbourhood` | Yes | `neighbourhood` may be `null` |
| `payAmount`, `payCurrency`, `payStructure` | Yes | |
| `duration` | **Yes** | Single string, e.g. `"3 months"` — **not** split into `durationValue` / `durationUnit` |
| `startDate` | Yes | ISO date `YYYY-MM-DD` or `null` |
| `startNow` | Yes | Boolean — no `startAsap` alias on API |
| `requirements`, `responsibilities` | Yes | `string[]` |
| `requiredSkills` | Yes | `string[]` |
| `numberOfOpenings` | Yes | |
| `paymentManagedByJoballa` | Yes | |
| `requestedDocuments` | Yes | Opaque JSON array |
| `status` | Yes | On card portion of detail |

**Mapper note:** There is no `durationValue` + `durationUnit` on the API. Parse or format `duration` as a single string on the client (same as create).

---

## 3. PATCH response

`PATCH /employer/jobs/:jobId` returns the updated **`EmployerJobDetail`** directly (not wrapped in `{ job: … }`).

You can refresh the split panel and detail view from this response without a second `GET`.

**Partial updates:** Only sent fields are updated. Omitted fields are unchanged.

**Clearing `startDate`:** Sending `startDate: null` does **not** clear an existing date today (omit the field or we can add explicit null handling in a follow-up if needed).

---

## 4. Moderation on edit

| Behaviour | Current backend |
| --- | --- |
| Active job content edit → `under_review`? | **No** — `status` unchanged |
| Re-scoring on edit? | **No** |
| `changeRequest` / `rejectionReason` on PATCH response? | Always **`null`** on employer job cards today (not loaded from `change_requests` / `rejection_reasons` tables yet) |

If product later requires re-review after editing live jobs, we will add status transition + populate `changeRequest` on the response. For now, edits apply immediately while the job stays **`active`**.

---

## 5. Validation errors

| Topic | Behaviour |
| --- | --- |
| HTTP status | **`400 Bad Request`** (not 422) for invalid enums / bad input |
| Shape | `{ statusCode, error, message, path, timestamp }` |
| Field-level map | **Not implemented** — `message` is a string, e.g. `"Invalid employmentType."` |
| Empty title/description on PATCH | Not rejected if omitted; if sent as `""`, stored as empty string |
| Invalid enum | `400` with `"Invalid {field}."` |
| Unknown job | `404` |
| Non-owner | `404` (same as not found) |

Create flow validates required fields; **PATCH is permissive** (partial body). Frontend should keep client-side required checks on save.

---

## Example — PATCH active job

**Request**

```http
PATCH /employer/jobs/:jobId
Authorization: Bearer …
Content-Type: application/json

{
  "title": "Senior Frontend Developer",
  "description": "Updated description.",
  "payAmount": 250000,
  "duration": "6 months"
}
```

**Response `200`** — full `EmployerJobDetail` with `"status": "active"` unchanged.

---

## Example — GET prefill (excerpt)

```json
{
  "id": "…",
  "departmentId": "…",
  "title": "Frontend Developer",
  "department": { "id": "…", "name": "Software & Tech", "slug": "software-tech", "category": "software_tech" },
  "workMode": "hybrid",
  "employmentType": "full_time",
  "experienceLevel": "mid",
  "country": "Cameroon",
  "region": "Littoral",
  "city": "Douala",
  "neighbourhood": null,
  "payAmount": 200000,
  "payCurrency": "XAF",
  "payStructure": "monthly",
  "duration": "3 months",
  "startDate": "2026-07-01",
  "startNow": false,
  "description": "…",
  "requirements": ["…"],
  "responsibilities": ["…"],
  "requiredSkills": ["React", "TypeScript"],
  "numberOfOpenings": 1,
  "paymentManagedByJoballa": false,
  "status": "active"
}
```

---

## Frontend action

- Prefill from `GET` using `departmentId`, `duration` (string), `experienceLevel`, `neighbourhood`, `startNow`.
- Save via `PATCH` with partial `UpdateEmployerJobRequest`.
- Use PATCH response to update list/detail UI.
- Status menu: **`PATCH …/status`** only — values `draft`, `under_review`, `active`, `paused`, `closed` (display **Active**, not Live).
- Do not expect field-level 422; map `400` `message` to a toast or inline banner for now.

---

## Code / docs updated

- `src/modules/v2/employer/employer-v2.service.ts` — `departmentId`, `neighbourhood`, `experienceLevel`, `duration` on job detail/card mapping
- `newschemaroutes/FRONTEND_EMPLOYER_ROUTES.md` — `EmployerJobDetail` fields
- This document
