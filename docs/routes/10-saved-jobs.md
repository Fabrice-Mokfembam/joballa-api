# Saved Jobs API

Base URL: `http://localhost:5000`
Auth header required: `Authorization: Bearer <token>` with role `WORKER`

Saving and unsaving jobs is handled via the Jobs API at `POST /api/jobs/:jobId/save` and `DELETE /api/jobs/:jobId/save`. This module covers listing and bulk removal.

---

### `GET /api/saved-jobs`

Returns the authenticated worker's saved jobs, newest first. Each item includes the full job card so the frontend does not need a second request.

**Query params:**

| Param   | Type   | Description            |
| ------- | ------ | ---------------------- |
| `page`  | number | Default `1`            |
| `limit` | number | Default `20`, max `50` |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "saved-job-uuid",
      "savedAt": "2026-03-10T08:00:00.000Z",
      "job": {
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
        "requiredSkills": ["cleaning"],
        "startAsap": true,
        "startDate": null,
        "status": "ACTIVE",
        "createdAt": "2026-03-01T10:00:00.000Z",
        "employer": {
          "id": "employer-uuid",
          "companyName": "HomeServices Cameroon",
          "logoUrl": "https://res.cloudinary.com/...",
          "verificationStatus": "VERIFIED"
        }
      }
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

Note: jobs with status other than `ACTIVE` (e.g. `CLOSED`, `PAUSED`) may appear in this list if they were saved before their status changed. Check `job.status` before showing an apply button.

---

### `DELETE /api/saved-jobs/:jobId`

Removes a single job from the saved list by its job ID.

**Response `204`:** no body.

**Response `404`:** the job was not in the worker's saved list.

---

### `DELETE /api/saved-jobs`

Bulk removes multiple saved jobs in one request. Useful for a "clear selected" action in the UI.

**Request body:**

```json
{
  "jobIds": ["job-uuid-1", "job-uuid-2", "job-uuid-3"]
}
```

| Field    | Type     | Required | Description                                |
| -------- | -------- | -------- | ------------------------------------------ |
| `jobIds` | string[] | Yes      | Array of job IDs to remove from saved list |

**Response `204`:** no body. Jobs not in the saved list are silently ignored.
