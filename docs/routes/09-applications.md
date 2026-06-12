# Applications API

Base URL: `http://localhost:5000`
Auth header required on all routes: `Authorization: Bearer <token>`

---

## Worker Routes

### `POST /api/jobs/:jobId/application/customize-profile`

Optional pre-apply step. Saves a per-job profile draft that overrides the worker's base profile for this specific application. The draft expires automatically after 7 days. If no customization is saved, the base profile is used on apply.

**Request body:**

```json
{
  "professionalSummary": "Experienced cleaner specialising in residential homes...",
  "skills": ["cleaning", "cooking", "childcare"],
  "workHistoryIds": ["work-history-uuid-1", "work-history-uuid-2"]
}
```

| Field                 | Type     | Required | Description                                                                                 |
| --------------------- | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `professionalSummary` | string   | No       | Overrides the worker's main bio for this application                                        |
| `skills`              | string[] | No       | Overrides the worker's main skills list                                                     |
| `workHistoryIds`      | string[] | No       | IDs of specific `WorkHistory` entries to include — fetch IDs from `GET /api/worker/profile` |

**Response `200`:** the saved customization draft.

---

### `POST /api/jobs/:jobId/apply`

Submits a job application. Requires profile completeness of at least **60%**. An immutable snapshot of the worker's profile is captured at submission time — employers always see what was submitted, even if the profile is updated later.

If a customization draft exists for this job, it is merged into the snapshot automatically, then deleted.

**Request body:**

```json
{
  "jobSpecificNote": "I am available to start immediately.",
  "attachedDocuments": ["https://res.cloudinary.com/joballa/..."]
}
```

| Field               | Type     | Required | Description                                             |
| ------------------- | -------- | -------- | ------------------------------------------------------- |
| `jobSpecificNote`   | string   | No       | Optional message to the employer                        |
| `attachedDocuments` | string[] | No       | Cloudinary URLs of any documents the employer requested |

**Response `201`:** created application with job summary.

**Response `403`:** profile completeness is below 60%.

**Response `409`:** worker has already applied to this job.

---

### `GET /api/applications`

Returns the authenticated worker's application history, newest first. Archived applications are excluded.

**Query params:**

| Param    | Type   | Description                                     |
| -------- | ------ | ----------------------------------------------- |
| `status` | string | `SUBMITTED`, `SHORTLISTED`, `HIRED`, `REJECTED` |
| `page`   | number | Default `1`                                     |
| `limit`  | number | Default `20`, max `50`                          |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "application-uuid",
      "status": "SHORTLISTED",
      "submittedAt": "2026-03-10T08:00:00.000Z",
      "jobSpecificNote": "Available immediately.",
      "employerNotes": null,
      "updatedAt": "2026-03-12T10:00:00.000Z",
      "job": {
        "id": "job-uuid",
        "title": "House Cleaner",
        "category": "Domestic",
        "location": "Douala",
        "payRate": "5000.00",
        "payStructure": "DAILY",
        "employer": {
          "companyName": "HomeServices Cameroon",
          "logoUrl": "https://res.cloudinary.com/..."
        }
      }
    }
  ],
  "total": 4,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/applications/:applicationId`

Full detail of a single application. Includes the job, employer info, the profile snapshot that was submitted, and the related engagement if the worker was hired.

**Response `200`:**

```json
{
  "id": "application-uuid",
  "status": "HIRED",
  "submittedAt": "2026-03-10T08:00:00.000Z",
  "profileSnapshot": {
    "fullName": "Jean Dupont",
    "professionalTitle": "House Cleaner",
    "skills": ["cleaning", "cooking"],
    "workHistory": [...],
    "snapshotAt": "2026-03-10T08:00:00.000Z"
  },
  "jobSpecificNote": "Available immediately.",
  "attachedDocuments": [],
  "employerNotes": "Great candidate.",
  "job": {
    "id": "job-uuid",
    "title": "House Cleaner",
    "employer": {
      "companyName": "HomeServices Cameroon",
      "logoUrl": "...",
      "industry": "Domestic Services",
      "location": "Douala"
    }
  },
  "engagement": {
    "id": "engagement-uuid",
    "status": "ACTIVE",
    "startDate": "2026-03-15T00:00:00.000Z",
    "endDate": null,
    "agreedRate": "5000.00",
    "payStructure": "DAILY"
  }
}
```

**Response `404`:** application does not exist or belongs to a different worker.

---

### `DELETE /api/applications/:applicationId`

Soft-archives an application from the worker's view. The record is preserved for the employer and audit trail — only the worker's list view is affected. Use this to clean up rejected applications from the UI.

**Response `204`:** no body.

---

## Employer Routes

All employer routes require role `EMPLOYER`.

### `GET /api/employer/jobs/:jobId/applicants`

Returns a paginated list of applicants for a specific job. Each item includes the immutable `profileSnapshot` captured at the time of application — this is what the employer should display, not the worker's current live profile.

**Query params:**

| Param    | Type   | Description                                     |
| -------- | ------ | ----------------------------------------------- |
| `status` | string | `SUBMITTED`, `SHORTLISTED`, `HIRED`, `REJECTED` |
| `page`   | number | Default `1`                                     |
| `limit`  | number | Default `20`                                    |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "application-uuid",
      "status": "SUBMITTED",
      "submittedAt": "2026-03-10T08:00:00.000Z",
      "jobSpecificNote": "Available immediately.",
      "employerNotes": null,
      "profileSnapshot": {
        "fullName": "Jean Dupont",
        "professionalTitle": "House Cleaner",
        "city": "Douala",
        "verificationStatus": "VERIFIED",
        "skills": ["cleaning", "cooking"],
        "languagesSpoken": ["English", "French"],
        "workHistory": [...],
        "education": [...],
        "snapshotAt": "2026-03-10T08:00:00.000Z"
      }
    }
  ],
  "total": 7,
  "page": 1,
  "limit": 20
}
```

---

### `PATCH /api/employer/applications/:applicationId/status`

Updates an application status. Optionally include a note visible to the employer for internal tracking.

**Request body:**

```json
{
  "status": "SHORTLISTED",
  "employerNotes": "Strong candidate — schedule interview."
}
```

| Field           | Type   | Required | Description                             |
| --------------- | ------ | -------- | --------------------------------------- |
| `status`        | string | Yes      | `SHORTLISTED`, `HIRED`, or `REJECTED`   |
| `employerNotes` | string | No       | Internal note — not shown to the worker |

**Response `200`:** updated application object.

**Response `403`:** the application does not belong to a job owned by this employer.

---

## Application Status Flow

```
SUBMITTED → SHORTLISTED → HIRED
SUBMITTED → REJECTED
SHORTLISTED → HIRED
SHORTLISTED → REJECTED
```

Status transitions are enforced by the employer via `PATCH /api/employer/applications/:applicationId/status`.
Workers receive their status as a read-only field on `GET /api/applications`.
