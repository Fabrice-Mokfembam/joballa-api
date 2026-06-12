# joballa — Workers Module API Reference

Complete reference for all Worker profile endpoints.

**Base URL:** `http://localhost:5000` (development)
**Base path:** `/api/worker`
**Auth:** Every endpoint requires `Authorization: Bearer <jwt_token>` with role `WORKER`

---

## Table of Contents

1. [Auth Header](#auth-header)
2. [Me](#1-me)
3. [Profile](#2-profile)
4. [Personal Info](#3-personal-info)
5. [Professional Summary](#4-professional-summary)
6. [Skills](#5-skills)
7. [Avatar](#6-avatar)
8. [Work History](#7-work-history)
9. [Education](#8-education)
10. [Certifications](#9-certifications)
11. [Documents](#10-documents)
12. [KYC](#11-kyc)
13. [Payment Details](#12-payment-details)
14. [Profile Completeness](#profile-completeness)
15. [Enum Reference](#enum-reference)
16. [Error Responses](#error-responses)

---

## Auth Header

Every request must include a valid JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Requests without a token receive `401 Unauthorized`.
Requests with a token that does not have the `WORKER` role receive `403 Forbidden`.

---

## 1. Me

### `GET /api/worker/me`

Returns the authenticated worker's session context and basic profile summary.
Use this on app launch to hydrate the current user's state.

**Request:** no body, no query params.

**Response `200`:**

```json
{
  "id": "user-uuid",
  "email": "worker@example.com",
  "phone": "+237612345678",
  "role": "WORKER",
  "languagePreference": "EN",
  "verificationStatus": "PENDING",
  "workerProfile": {
    "id": "worker-profile-uuid",
    "fullName": "Jean Dupont",
    "firstName": "Jean",
    "lastName": "Dupont",
    "city": "Douala",
    "region": "Littoral",
    "country": "Cameroon",
    "professionalTitle": "House Cleaner",
    "bio": null,
    "profileCompleteness": 40,
    "availabilityStatus": "AVAILABLE",
    "verificationStatus": "PENDING",
    "nationalIdDocUrl": null,
    "uploadedResumeUrl": null
  }
}
```

---

## 2. Profile

### `GET /api/worker/profile`

Returns the full authenticated worker profile including all sub-sections:
work history, education, certifications, documents, and latest KYC submission.

**Response `200`:**

```json
{
  "id": "worker-profile-uuid",
  "userId": "user-uuid",
  "fullName": "Jean Dupont",
  "firstName": "Jean",
  "lastName": "Dupont",
  "city": "Douala",
  "region": "Littoral",
  "country": "Cameroon",
  "professionalTitle": "House Cleaner",
  "bio": "Experienced domestic worker...",
  "industries": ["Domestic", "Events"],
  "preferredJobCategories": ["DOMESTIC", "EVENTS"],
  "preferredJobTypes": ["CASUAL", "PART_TIME"],
  "availabilityStatus": "AVAILABLE",
  "skills": ["cooking", "cleaning", "childcare"],
  "languagesSpoken": ["English", "French", "Pidgin"],
  "profileCompleteness": 70,
  "mobileMoneyProvider": "MTN_MOMO",
  "mobileMoneyNumber": "+237612345678",
  "bankName": null,
  "bankAccountNumber": null,
  "verificationStatus": "PENDING",
  "nationalIdDocUrl": null,
  "uploadedResumeUrl": null,
  "user": {
    "email": "worker@example.com",
    "phone": "+237612345678",
    "languagePreference": "EN"
  },
  "workHistories": [
    {
      "id": "work-history-uuid",
      "company": "HomeServices Cameroon",
      "role": "House Cleaner",
      "location": "Douala",
      "description": "Responsible for full house cleaning...",
      "startDate": "2023-01-01T00:00:00.000Z",
      "endDate": "2024-06-01T00:00:00.000Z",
      "isCurrent": false,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "educations": [],
  "certifications": [],
  "documents": [],
  "kycSubmissions": []
}
```

---

### `GET /api/worker/profile/:workerId/public`

Returns the public-facing profile of any worker by their `WorkerProfile` ID.
Sensitive fields (payment details, KYC, documents, bank info) are excluded.
Used to display a worker's profile to an employer reviewing applications.

**Path params:**

| Param      | Type            | Description                        |
| ---------- | --------------- | ---------------------------------- |
| `workerId` | `string (UUID)` | The WorkerProfile ID (not User ID) |

**Response `200`:** subset of profile fields — name, title, bio, skills,
work history, education, certifications, availability, languages, verification status.

---

## 3. Personal Info

### `PATCH /api/worker/profile/personal-info`

Updates the worker's personal information. All fields are optional —
only include what needs to change. Automatically recomputes profile completeness.

**Request body:**

```json
{
  "firstName": "Jean",
  "lastName": "Dupont",
  "country": "Cameroon",
  "city": "Douala",
  "region": "Littoral",
  "languages": ["English", "French", "Pidgin"],
  "availabilityStatus": "AVAILABLE"
}
```

| Field                | Type                 | Required | Description                                                   |
| -------------------- | -------------------- | -------- | ------------------------------------------------------------- |
| `firstName`          | `string`             | No       |                                                               |
| `lastName`           | `string`             | No       | `fullName` is derived automatically from first + last         |
| `country`            | `string`             | No       |                                                               |
| `city`               | `string`             | No       |                                                               |
| `region`             | `string`             | No       |                                                               |
| `languages`          | `string[]`           | No       | Full list of spoken languages                                 |
| `availableToWork`    | `boolean`            | No       | Shorthand: `true` → `AVAILABLE`, `false` → `NOT_AVAILABLE`    |
| `availabilityStatus` | `AvailabilityStatus` | No       | Use for precise status. Takes priority over `availableToWork` |

**Response `200`:** updated `WorkerProfile` object.

---

## 4. Professional Summary

### `PATCH /api/worker/profile/professional-summary`

Updates the worker's professional identity — title, bio, industries, preferred job types.
Automatically recomputes profile completeness.

**Request body:**

```json
{
  "title": "Experienced House Cleaner",
  "summary": "Dedicated domestic worker with 3 years experience...",
  "industries": ["Domestic", "Events"],
  "preferredJobTypes": ["CASUAL", "PART_TIME"]
}
```

| Field               | Type        | Required | Description                                            |
| ------------------- | ----------- | -------- | ------------------------------------------------------ |
| `title`             | `string`    | No       | Professional title shown on profile card               |
| `summary`           | `string`    | No       | Bio / professional summary                             |
| `industries`        | `string[]`  | No       | Industry categories the worker operates in             |
| `preferredJobTypes` | `JobType[]` | No       | See [Enum Reference](#enum-reference) for valid values |

**Response `200`:** updated `WorkerProfile` object.

---

## 5. Skills

### `PATCH /api/worker/profile/skills`

Replaces the worker's full skills list. Send the **complete** desired list —
this is a replace operation, not an append. Recomputes completeness.

**Request body:**

```json
{
  "skills": ["cooking", "cleaning", "childcare", "ironing"]
}
```

| Field    | Type       | Required | Description                               |
| -------- | ---------- | -------- | ----------------------------------------- |
| `skills` | `string[]` | **Yes**  | Complete skills array — replaces existing |

**Response `200`:** updated `WorkerProfile` object.

---

## 6. Avatar

### `POST /api/worker/profile/avatar`

Uploads a profile photo. Send as `multipart/form-data` with field name `file`.

> ⚠️ **Stub** — full Cloudinary upload is pending wiring. Currently validates
> the file and returns a stub response. The endpoint is live and testable.

**Request:** `multipart/form-data`

| Field  | Type   | Required | Description                  |
| ------ | ------ | -------- | ---------------------------- |
| `file` | `File` | **Yes**  | JPEG, PNG, or WEBP. Max 5 MB |

**Response `200`:**

```json
{
  "message": "Avatar upload stub — wire FilesService to complete",
  "filename": "photo.jpg",
  "size": 204800
}
```

**Response `400`:** file type not allowed or file exceeds 5 MB.

---

## 7. Work History

Each work history entry has its own ID allowing individual updates and deletes.

### `POST /api/worker/profile/work-history`

**Request body:**

```json
{
  "company": "HomeServices Cameroon",
  "role": "House Cleaner",
  "location": "Douala",
  "description": "Full house cleaning, laundry, cooking for a family of 5.",
  "startDate": "2023-01-15",
  "endDate": "2024-06-01",
  "isCurrent": false
}
```

| Field         | Type                | Required | Description                          |
| ------------- | ------------------- | -------- | ------------------------------------ |
| `company`     | `string`            | **Yes**  | Employer name                        |
| `role`        | `string`            | **Yes**  | Job title held                       |
| `location`    | `string`            | No       |                                      |
| `description` | `string`            | No       |                                      |
| `startDate`   | `string (ISO date)` | **Yes**  | e.g. `"2023-01-15"`                  |
| `endDate`     | `string (ISO date)` | No       | Omit if `isCurrent` is `true`        |
| `isCurrent`   | `boolean`           | No       | Cannot be `true` if `endDate` is set |

**Response `201`:** created `WorkHistory` object with its `id`.

**Response `400`:** if `isCurrent: true` and `endDate` is also provided.

---

### `PATCH /api/worker/profile/work-history/:workId`

Updates a single work history entry. All fields optional.

**Path params:** `workId` — the WorkHistory record ID from the list.

**Request body:** same fields as create, all optional.

**Response `200`:** updated `WorkHistory` object.

---

### `DELETE /api/worker/profile/work-history/:workId`

Permanently deletes a work history entry. Recomputes completeness.

**Response `204`:** no body.

---

## 8. Education

Same pattern as Work History — each entry has its own ID.

### `POST /api/worker/profile/education`

**Request body:**

```json
{
  "school": "University of Buea",
  "degree": "Bachelor of Science",
  "fieldOfStudy": "Computer Science",
  "startDate": "2018-09-01",
  "endDate": "2022-06-30",
  "isCurrent": false
}
```

| Field          | Type                | Required | Description                               |
| -------------- | ------------------- | -------- | ----------------------------------------- |
| `school`       | `string`            | **Yes**  | Institution name                          |
| `degree`       | `string`            | No       | e.g. "Bachelor", "HND", "Certificate"     |
| `fieldOfStudy` | `string`            | No       |                                           |
| `startDate`    | `string (ISO date)` | **Yes**  |                                           |
| `endDate`      | `string (ISO date)` | No       | Omit if `isCurrent` is `true`             |
| `isCurrent`    | `boolean`           | No       | Cannot be `true` if `endDate` is provided |

**Response `201`:** created `Education` object with its `id`.

---

### `PATCH /api/worker/profile/education/:educationId`

Updates a single education entry. All fields optional.

**Response `200`:** updated `Education` object.

---

### `DELETE /api/worker/profile/education/:educationId`

Permanently deletes an education entry. Recomputes completeness.

**Response `204`:** no body.

---

## 9. Certifications

### `POST /api/worker/profile/certifications`

**Request body:**

```json
{
  "name": "Food Handler Certificate",
  "issuer": "Cameroon Ministry of Health",
  "issueDate": "2023-03-01",
  "expiryDate": "2026-03-01",
  "fileUrl": "https://res.cloudinary.com/joballa/..."
}
```

| Field        | Type                | Required | Description                                               |
| ------------ | ------------------- | -------- | --------------------------------------------------------- |
| `name`       | `string`            | **Yes**  | Certificate name                                          |
| `issuer`     | `string`            | No       | Issuing organisation                                      |
| `issueDate`  | `string (ISO date)` | No       |                                                           |
| `expiryDate` | `string (ISO date)` | No       |                                                           |
| `fileUrl`    | `string`            | No       | Cloudinary URL — upload via `POST /files/portfolio` first |

**Response `201`:** created `Certification` object with its `id`.

---

### `PATCH /api/worker/profile/certifications/:certId`

All fields optional.

**Response `200`:** updated `Certification` object.

---

### `DELETE /api/worker/profile/certifications/:certId`

**Response `204`:** no body.

---

## 10. Documents

### `POST /api/worker/profile/documents`

Upload a CV, portfolio, or certificate document.
Send as `multipart/form-data` with field name `file`.

> ⚠️ **Stub** — full Cloudinary upload is pending wiring.
> Endpoint is live and validates the file.

**Request:** `multipart/form-data`

| Field  | Type   | Required | Description                        |
| ------ | ------ | -------- | ---------------------------------- |
| `file` | `File` | **Yes**  | JPEG, PNG, WEBP, or PDF. Max 10 MB |

**Query params:**

| Param  | Type           | Description                                  |
| ------ | -------------- | -------------------------------------------- |
| `type` | `DocumentType` | `CV`, `CERTIFICATE`, `PORTFOLIO`, or `OTHER` |

---

### `GET /api/worker/profile/documents`

Returns all uploaded documents for the authenticated worker, newest first.

**Response `200`:**

```json
[
  {
    "id": "document-uuid",
    "workerId": "worker-profile-uuid",
    "type": "CV",
    "fileName": "jean-dupont-cv.pdf",
    "fileUrl": "https://res.cloudinary.com/joballa/...",
    "fileSize": 512000,
    "mimeType": "application/pdf",
    "uploadedAt": "2026-03-01T10:00:00.000Z"
  }
]
```

---

### `DELETE /api/worker/profile/documents/:documentId`

Permanently deletes a document record. The Cloudinary asset should also be
removed — call `DELETE /files/:publicId` alongside this.

**Response `204`:** no body.

---

## 11. KYC

KYC (Know Your Customer) is the identity verification process. Workers must
upload their National ID before submitting. Images should be uploaded to
Cloudinary first via `POST /files/verification-doc`, then the returned URLs
are passed to this endpoint.

### `POST /api/worker/profile/kyc`

Submits a new KYC verification request.

> A new submission cannot be made while one is `PENDING` or already `VERIFIED`.

**Request body:**

```json
{
  "frontIdImageUrl": "https://res.cloudinary.com/joballa/verification-docs/...",
  "backIdImageUrl": "https://res.cloudinary.com/joballa/verification-docs/...",
  "documentType": "NATIONAL_ID"
}
```

| Field             | Type              | Required | Description                                             |
| ----------------- | ----------------- | -------- | ------------------------------------------------------- |
| `frontIdImageUrl` | `string`          | **Yes**  | Cloudinary URL of the front of the ID                   |
| `backIdImageUrl`  | `string`          | No       | Cloudinary URL of the back (not required for passports) |
| `documentType`    | `KYCDocumentType` | **Yes**  | `NATIONAL_ID`, `PASSPORT`, or `DRIVERS_LICENSE`         |

**Response `201`:** created `KYCSubmission` object.

**Response `400`:** if a submission is already `PENDING` or status is `VERIFIED`.

---

### `GET /api/worker/profile/kyc`

Returns the most recent KYC submission and its current status.

**Response `200`:**

```json
{
  "id": "kyc-uuid",
  "workerId": "worker-profile-uuid",
  "documentType": "NATIONAL_ID",
  "frontImageUrl": "https://res.cloudinary.com/...",
  "backImageUrl": "https://res.cloudinary.com/...",
  "status": "PENDING",
  "submittedAt": "2026-03-10T09:00:00.000Z",
  "reviewedAt": null,
  "reviewNotes": null
}
```

**Response `200` (null):** if no KYC has been submitted yet.

**`status` values:**

| Value                | Meaning                                     |
| -------------------- | ------------------------------------------- |
| `PENDING`            | Submitted, awaiting Admin review            |
| `VERIFIED`           | Approved — worker is identity verified      |
| `REJECTED`           | Rejected — check `reviewNotes` and resubmit |
| `MORE_INFO_REQUIRED` | Admin needs additional information          |

---

## 12. Payment Details

### `PATCH /api/worker/profile/payment-details`

Updates the worker's mobile money and/or bank account details.
Used to receive payments after completing engagements. All fields optional.

**Request body:**

```json
{
  "mobileMoneyProvider": "MTN_MOMO",
  "mobileMoneyNumber": "+237612345678",
  "bankName": "Afriland First Bank",
  "accountNumber": "000123456789"
}
```

| Field                 | Type           | Required | Description                  |
| --------------------- | -------------- | -------- | ---------------------------- |
| `mobileMoneyProvider` | `MomoProvider` | No       | `MTN_MOMO` or `ORANGE_MONEY` |
| `mobileMoneyNumber`   | `string`       | No       | Mobile money phone number    |
| `bankName`            | `string`       | No       | Bank name                    |
| `accountNumber`       | `string`       | No       | Bank account number          |

**Response `200`:** updated `WorkerProfile` object.

---

## Profile Completeness

Profile completeness is a score from `0` to `100` computed automatically after
every profile update. It is stored on the `WorkerProfile` as `profileCompleteness`.

A minimum score of **60** is required to submit a job application.

| Section                           | Points  |
| --------------------------------- | ------- |
| Full name                         | 10      |
| Professional title                | 10      |
| Bio / summary                     | 10      |
| Skills (at least one)             | 15      |
| Work history (at least one entry) | 15      |
| Education (at least one entry)    | 10      |
| Languages spoken                  | 5       |
| Profile photo                     | 5       |
| Payment details (MoMo or bank)    | 10      |
| KYC submitted                     | 10      |
| **Total**                         | **100** |

---

## Enum Reference

### `AvailabilityStatus`

```
AVAILABLE | OPEN_TO_OFFERS | NOT_AVAILABLE
```

### `JobType`

```
FULL_TIME | PART_TIME | CONTRACT | CASUAL | SEASONAL | INTERNSHIP
```

### `MomoProvider`

```
MTN_MOMO | ORANGE_MONEY
```

### `KYCDocumentType`

```
NATIONAL_ID | PASSPORT | DRIVERS_LICENSE
```

### `DocumentType`

```
CV | CERTIFICATE | PORTFOLIO | OTHER
```

### `VerificationStatus` (read-only — set by Admin)

```
PENDING | VERIFIED | REJECTED | MORE_INFO_REQUIRED
```

---

## Error Responses

All errors follow the standard NestJS format:

```json
{
  "statusCode": 400,
  "message": "A current position cannot have an end date",
  "error": "Bad Request"
}
```

| Status                      | When                                                                              |
| --------------------------- | --------------------------------------------------------------------------------- |
| `400 Bad Request`           | Validation failed or business rule violated                                       |
| `401 Unauthorized`          | Missing or expired JWT token                                                      |
| `403 Forbidden`             | Token is valid but role is not `WORKER`, or profile completeness too low to apply |
| `404 Not Found`             | Record does not exist or does not belong to this worker                           |
| `409 Conflict`              | Duplicate — e.g. resubmitting KYC while one is already pending                    |
| `500 Internal Server Error` | Unexpected error — check Sentry                                                   |
