# Jobs API

Base URL: `http://localhost:5000`
Auth header required on all routes: `Authorization: Bearer <token>`

---

## Worker Routes

### `GET /api/jobs`

Search and filter active job listings. Hidden jobs are automatically excluded from results.

**Query params:**

| Param          | Type         | Description                                                              |
| -------------- | ------------ | ------------------------------------------------------------------------ |
| `keyword`      | string       | Searches title, description, and category                                |
| `city`         | string       | Filter by city                                                           |
| `category`     | string       | Filter by job category                                                   |
| `jobType`      | JobType      | `FULL_TIME`, `PART_TIME`, `CONTRACT`, `CASUAL`, `SEASONAL`, `INTERNSHIP` |
| `workMode`     | WorkMode     | `ON_SITE`, `REMOTE`, `HYBRID`                                            |
| `payStructure` | PayStructure | `HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY`, `FIXED`                          |
| `minPay`       | number       | Minimum pay rate                                                         |
| `maxPay`       | number       | Maximum pay rate                                                         |
| `sortBy`       | string       | `createdAt` or `payRate`                                                 |
| `sortOrder`    | string       | `asc` or `desc`                                                          |
| `page`         | number       | Default `1`                                                              |
| `limit`        | number       | Default `20`, max `50`                                                   |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "job-uuid",
      "title": "House Cleaner",
      "category": "Domestic",
      "jobType": "CASUAL",
      "workMode": "ON_SITE",
      "location": "Douala, Akwa",
      "city": "Douala",
      "payRate": "5000.00",
      "payStructure": "DAILY",
      "currency": "XAF",
      "numberOfOpenings": 2,
      "requiredSkills": ["cleaning", "cooking"],
      "requiredLevel": null,
      "startAsap": true,
      "startDate": null,
      "status": "ACTIVE",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "employer": {
        "id": "employer-uuid",
        "companyName": "HomeServices Cameroon",
        "logoUrl": "https://res.cloudinary.com/...",
        "isJoballaDepartment": false,
        "verificationStatus": "VERIFIED"
      }
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/jobs/:jobId`

Full detail of a single active job including employer info and applicant count.

**Response `200`:**

```json
{
  "id": "job-uuid",
  "title": "House Cleaner",
  "description": "Looking for an experienced cleaner...",
  "category": "Domestic",
  "jobType": "CASUAL",
  "workMode": "ON_SITE",
  "location": "Douala, Akwa",
  "city": "Douala",
  "neighbourhood": "Akwa",
  "payRate": "5000.00",
  "payStructure": "DAILY",
  "currency": "XAF",
  "startDate": null,
  "endDate": null,
  "startAsap": true,
  "durationValue": 4,
  "durationUnit": "Weeks",
  "numberOfOpenings": 2,
  "requiredSkills": ["cleaning", "cooking"],
  "requiredLevel": null,
  "requirements": ["Own transportation"],
  "responsibilities": ["Full house cleaning", "Laundry"],
  "requestedDocuments": [],
  "status": "ACTIVE",
  "createdAt": "2026-03-01T10:00:00.000Z",
  "employer": {
    "id": "employer-uuid",
    "companyName": "HomeServices Cameroon",
    "industry": "Domestic Services",
    "logoUrl": "https://res.cloudinary.com/...",
    "about": "We connect families with trusted domestic workers.",
    "location": "Douala",
    "website": null,
    "verificationStatus": "VERIFIED",
    "isJoballaDepartment": false,
    "departmentCategory": null
  },
  "_count": { "applications": 7 }
}
```

**Response `404`:** job does not exist or is not `ACTIVE`.

---

### `POST /api/jobs/:jobId/save`

Saves a job to the worker's saved list. Safe to call multiple times — duplicate saves are ignored.

**Response `200`:** saved job record.

---

### `DELETE /api/jobs/:jobId/save`

Removes a job from the saved list.

**Response `204`:** no body.

---

### `POST /api/jobs/:jobId/hide`

Hides a job from the worker's search results permanently. The job will not appear in `GET /api/jobs` for this worker.

**Response `200`:** hidden job record.

---

### `DELETE /api/jobs/:jobId/hide`

Unhides a job — it will reappear in search results.

**Response `204`:** no body.

---

### `POST /api/jobs/:jobId/report`

Reports a suspicious or inappropriate job to the Admin team.

**Request body:**

```json
{
  "reason": "FAKE_JOB",
  "description": "This job is asking for upfront payment."
}
```

| Field         | Type            | Required | Description        |
| ------------- | --------------- | -------- | ------------------ |
| `reason`      | JobReportReason | Yes      | See enum below     |
| `description` | string          | No       | Additional context |

**`reason` values:** `FAKE_JOB`, `MISLEADING_DESCRIPTION`, `INAPPROPRIATE_CONTENT`, `SCAM`, `DUPLICATE`, `OTHER`

**Response `201`:** report record.

---

### `GET /api/jobs/:jobId/share`

Returns a shareable deep link for a job.

**Response `200`:**

```json
{ "url": "https://joballa.com/jobs/job-uuid" }
```

---

## Employer Routes

All employer routes require role `EMPLOYER`.

### `POST /api/employer/jobs`

Creates a new job posting. All new jobs enter the Admin review queue with status `UNDER_REVIEW` before going live.

**Request body:**

```json
{
  "title": "House Cleaner",
  "description": "Looking for an experienced cleaner for a 3-bedroom home.",
  "category": "Domestic",
  "jobType": "CASUAL",
  "workMode": "ON_SITE",
  "location": "Douala, Akwa",
  "city": "Douala",
  "neighbourhood": "Akwa",
  "payRate": 5000,
  "payStructure": "DAILY",
  "currency": "XAF",
  "startAsap": true,
  "durationValue": 4,
  "durationUnit": "Weeks",
  "numberOfOpenings": 1,
  "requiredSkills": ["cleaning", "cooking"],
  "requiredLevel": "Entry",
  "requirements": ["Own transportation"],
  "responsibilities": ["Full house cleaning", "Laundry"],
  "requestedDocuments": []
}
```

| Field                | Type            | Required                        |
| -------------------- | --------------- | ------------------------------- |
| `title`              | string          | Yes                             |
| `description`        | string          | Yes                             |
| `category`           | string          | Yes                             |
| `jobType`            | JobType         | Yes                             |
| `location`           | string          | Yes                             |
| `payRate`            | number          | Yes                             |
| `payStructure`       | PayStructure    | Yes                             |
| `workMode`           | WorkMode        | No — defaults to `ON_SITE`      |
| `city`               | string          | No                              |
| `neighbourhood`      | string          | No                              |
| `currency`           | string          | No — defaults to `XAF`          |
| `startDate`          | ISO date string | No                              |
| `endDate`            | ISO date string | No                              |
| `startAsap`          | boolean         | No                              |
| `durationValue`      | number          | No                              |
| `durationUnit`       | string          | No — e.g. `"Weeks"`, `"Months"` |
| `numberOfOpenings`   | number          | No — defaults to `1`            |
| `requiredSkills`     | string[]        | No                              |
| `requiredLevel`      | string          | No — e.g. `"Entry"`, `"Senior"` |
| `requirements`       | string[]        | No                              |
| `responsibilities`   | string[]        | No                              |
| `requestedDocuments` | string[]        | No                              |

**Response `201`:** created job object with `status: "UNDER_REVIEW"`.

---

### `GET /api/employer/jobs`

Lists all jobs posted by the authenticated employer.

**Query params:**

| Param     | Type   | Description                                                               |
| --------- | ------ | ------------------------------------------------------------------------- |
| `status`  | string | Filter: `DRAFT`, `UNDER_REVIEW`, `ACTIVE`, `PAUSED`, `CLOSED`, `REJECTED` |
| `keyword` | string | Search by title or category                                               |
| `page`    | number | Default `1`                                                               |
| `limit`   | number | Default `20`, max `50`                                                    |

**Response `200`:** paginated list with `_count.applications` per job.

---

### `GET /api/employer/jobs/:jobId`

Full detail of a single job owned by the employer. Includes application and engagement counts.

**Response `404`:** job does not exist or belongs to a different employer.

---

### `PATCH /api/employer/jobs/:jobId`

Updates a job. All fields are optional. If the job is currently `ACTIVE` or `PAUSED`, editing it re-enters the Admin review queue automatically and clears `approvedById`.

**Request body:** same fields as create, all optional.

**Response `200`:** updated job object.

---

### `PATCH /api/employer/jobs/:jobId/status`

Changes a job's status. Only valid transitions are allowed.

**Request body:**

```json
{ "status": "PAUSED" }
```

**Valid transitions:**

| From                 | To       |
| -------------------- | -------- |
| `ACTIVE`             | `PAUSED` |
| `PAUSED`             | `ACTIVE` |
| `ACTIVE` or `PAUSED` | `CLOSED` |

**Response `400`:** if the transition is not valid.

---

### `DELETE /api/employer/jobs/:jobId`

Deletes or closes a job depending on its current status.

- `DRAFT` or `REJECTED` → permanently deleted
- Any other status → set to `CLOSED` to preserve application history

**Response `204`:** no body.

---

## Enum Reference

### `JobType`

`FULL_TIME` `PART_TIME` `CONTRACT` `CASUAL` `SEASONAL` `INTERNSHIP`

### `WorkMode`

`ON_SITE` `REMOTE` `HYBRID`

### `PayStructure`

`HOURLY` `DAILY` `WEEKLY` `MONTHLY` `FIXED`

### `JobStatus`

`DRAFT` `UNDER_REVIEW` `ACTIVE` `PAUSED` `CLOSED` `REJECTED`

### `JobReportReason`

`FAKE_JOB` `MISLEADING_DESCRIPTION` `INAPPROPRIATE_CONTENT` `SCAM` `DUPLICATE` `OTHER`
