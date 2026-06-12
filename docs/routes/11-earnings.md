# Earnings API

Base URL: `http://localhost:5000`
Auth header required: `Authorization: Bearer <token>` with role `WORKER`

All monetary values are in **XAF (CFA Franc)** unless stated otherwise.

---

### `GET /api/earnings/summary`

Returns an overview of the worker's total earnings. Use this to populate the earnings dashboard header — total earned, pending amount, and this month's total.

**Request:** no body, no query params.

**Response `200`:**

```json
{
  "totalEarned": 125000,
  "totalPayments": 8,
  "pendingAmount": 15000,
  "thisMonthTotal": 25000,
  "currency": "XAF"
}
```

| Field            | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `totalEarned`    | Sum of all `COMPLETED` payments all time                |
| `totalPayments`  | Count of completed payment transactions                 |
| `pendingAmount`  | Sum of payments currently in `PENDING` status           |
| `thisMonthTotal` | Sum of completed payments in the current calendar month |

---

### `GET /api/earnings/transactions`

Returns a paginated, filterable transaction history. Each transaction is linked to the engagement and employer it came from.

**Query params:**

| Param          | Type            | Description                                    |
| -------------- | --------------- | ---------------------------------------------- |
| `status`       | string          | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`   |
| `engagementId` | string          | Filter transactions for a specific engagement  |
| `from`         | ISO date string | Start of date range — filters by `initiatedAt` |
| `to`           | ISO date string | End of date range                              |
| `page`         | number          | Default `1`                                    |
| `limit`        | number          | Default `20`, max `50`                         |

**Response `200`:**

```json
{
  "items": [
    {
      "id": "payment-uuid",
      "amount": "15000.00",
      "currency": "XAF",
      "status": "COMPLETED",
      "mobileMoneyProvider": "MTN_MOMO",
      "recipientNumber": "+237612345678",
      "payPeriod": "2026-03",
      "initiatedAt": "2026-03-31T10:00:00.000Z",
      "confirmedAt": "2026-03-31T10:02:15.000Z",
      "failureReason": null,
      "engagement": {
        "id": "engagement-uuid",
        "job": {
          "id": "job-uuid",
          "title": "House Cleaner"
        },
        "employer": {
          "companyName": "HomeServices Cameroon",
          "logoUrl": "https://res.cloudinary.com/..."
        }
      }
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/earnings/statement`

Returns a flat list of all completed payments in a date range. Designed for export — returns all matching records without pagination so the frontend can generate a PDF or CSV statement from the full dataset.

**Query params:**

| Param  | Type            | Description                                                        |
| ------ | --------------- | ------------------------------------------------------------------ |
| `from` | ISO date string | Start of range — filters by `confirmedAt`. Defaults to 30 days ago |
| `to`   | ISO date string | End of range. Defaults to today                                    |

**Response `200`:**

```json
[
  {
    "id": "payment-uuid",
    "amount": "15000.00",
    "currency": "XAF",
    "mobileMoneyProvider": "MTN_MOMO",
    "payPeriod": "2026-03",
    "confirmedAt": "2026-03-31T10:02:15.000Z",
    "engagement": {
      "job": { "title": "House Cleaner" },
      "employer": { "companyName": "HomeServices Cameroon" }
    }
  }
]
```

This endpoint does not paginate. If building a PDF statement, call this with explicit `from` and `to` params to define the statement period.

---

## Payment Status Reference

| Status      | Meaning                                                |
| ----------- | ------------------------------------------------------ |
| `PENDING`   | Payment initiated — awaiting mobile money confirmation |
| `COMPLETED` | Funds disbursed and confirmed                          |
| `FAILED`    | Disbursement failed — see `failureReason`              |
| `REFUNDED`  | Payment was reversed                                   |

## Mobile Money Providers

| Value          | Provider         |
| -------------- | ---------------- |
| `MTN_MOMO`     | MTN Mobile Money |
| `ORANGE_MONEY` | Orange Money     |
