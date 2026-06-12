# Engagements API

Base URL: `http://localhost:3000`
Auth header required: `Authorization: Bearer <token>`

An engagement is created when an employer hires a worker. It represents the active working relationship — it holds the agreed rate, shift logs, and feeds into payments.

---

## Worker Routes

### `GET /api/worker/engagements`

Returns the authenticated worker's engagement history.

**Query params:**

| Param    | Type   | Description                         |
| -------- | ------ | ----------------------------------- |
| `status` | string | `ACTIVE`, `COMPLETED`, `TERMINATED` |
| `page`   | number | Default `1`                         |
| `limit`  | number | Default `20`, max `50`              |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "engagement-uuid",
      "startDate": "2026-03-15T00:00:00.000Z",
      "endDate": null,
      "agreedRate": "5000.00",
      "payStructure": "DAILY",
      "status": "ACTIVE",
      "taskNotes": null,
      "createdAt": "2026-03-14T10:00:00.000Z",
      "job": {
        "id": "job-uuid",
        "title": "House Cleaner",
        "category": "Domestic",
        "location": "Douala",
        "payRate": "5000.00",
        "payStructure": "DAILY"
      },
      "worker": {
        "id": "worker-uuid",
        "fullName": "Jean Dupont",
        "professionalTitle": "House Cleaner",
        "city": "Douala",
        "verificationStatus": "VERIFIED"
      },
      "employer": {
        "id": "employer-uuid",
        "companyName": "HomeServices Cameroon",
        "logoUrl": "https://res.cloudinary.com/..."
      },
      "shiftLogs": [],
      "_count": {
        "payments": 2,
        "shiftLogs": 12
      }
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/worker/engagements/:engagementId`

Full detail of a single engagement including all shift logs.

**Response `404`:** engagement does not exist or belongs to a different worker.

---

## Employer Routes

All employer routes require role `EMPLOYER`.

### `GET /api/employer/engagements`

Returns all engagements managed by the authenticated employer.

**Query params:**

| Param    | Type   | Description                         |
| -------- | ------ | ----------------------------------- |
| `status` | string | `ACTIVE`, `COMPLETED`, `TERMINATED` |
| `page`   | number | Default `1`                         |
| `limit`  | number | Default `20`, max `50`              |

**Response `200`:** same shape as worker engagements list above.

---

### `GET /api/employer/engagements/:engagementId`

Full detail of a single engagement owned by the employer, including all shift logs.

**Response `404`:** engagement does not exist or belongs to a different employer.

---

### `POST /api/employer/engagements/:engagementId/shift-logs`

Logs a shift for a worker on an active engagement. Used to record hours worked per day for payroll calculation.

**Request body:**

```json
{
  "date": "2026-03-20",
  "hoursWorked": 8,
  "notes": "Deep clean of the living room and kitchen."
}
```

| Field         | Type            | Required | Description                                     |
| ------------- | --------------- | -------- | ----------------------------------------------- |
| `date`        | ISO date string | Yes      | Date the shift took place — e.g. `"2026-03-20"` |
| `hoursWorked` | number          | Yes      | Must be between `0` and `24`                    |
| `notes`       | string          | No       | Optional notes about the shift                  |

**Response `201`:** created shift log record.

**Response `400`:** `hoursWorked` is outside the valid range.

---

### `GET /api/employer/engagements/:engagementId/shift-logs`

Returns all shift logs for an engagement, ordered newest first.

**Response `200`:**

```json
[
  {
    "id": "shift-log-uuid",
    "engagementId": "engagement-uuid",
    "date": "2026-03-20T00:00:00.000Z",
    "hoursWorked": "8.00",
    "notes": "Deep clean of living room and kitchen.",
    "loggedBy": "employer",
    "createdAt": "2026-03-20T18:00:00.000Z"
  }
]
```

---

### `DELETE /api/employer/engagements/:engagementId/shift-logs/:shiftLogId`

Deletes a shift log entry.

**Response `204`:** no body.

**Response `403`:** the shift log does not belong to an engagement owned by this employer.

---

### `POST /api/employer/engagements/:engagementId/end`

Ends an active engagement. Sets the status to `TERMINATED` and records the reason.

**Request body:**

```json
{
  "reason": "Contract period completed successfully.",
  "endDate": "2026-04-15"
}
```

| Field     | Type            | Required | Description                       |
| --------- | --------------- | -------- | --------------------------------- |
| `reason`  | string          | Yes      | Reason for ending the engagement  |
| `endDate` | ISO date string | No       | Defaults to today if not provided |

**Response `200`:** updated engagement with `status: "TERMINATED"`.

---

## Engagement Status Reference

| Status       | Meaning                                           |
| ------------ | ------------------------------------------------- |
| `ACTIVE`     | Engagement is ongoing                             |
| `COMPLETED`  | Engagement ended naturally at the agreed end date |
| `TERMINATED` | Engagement ended early by the employer            |
