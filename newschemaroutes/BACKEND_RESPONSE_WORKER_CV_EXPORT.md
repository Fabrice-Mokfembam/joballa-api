# Backend Response: Worker CV Export

**Status:** Implemented (June 2026)  
**Storage:** Cloudinary (`joballa/generated-cv-exports`) — survives deploys/restarts  
**PDF engine:** PDFKit (server-side)

This document answers the frontend integration questions and defines the final API contract.

---

## Frontend integration answers

| Question | Answer |
| --- | --- |
| 1. Direct PDF binary? | **Yes.** `POST` and `GET` return `application/pdf` bytes, not JSON. |
| 2. Final routes & methods? | See table below. |
| 3. Is `/status` implemented? | **Yes** — `GET /worker/profile/cv-export/status` |
| 4. Minimum profile fields? | **`fullName`** (or first+last) **and** **`shortBio`** (professional summary) |
| 5. Replace or version? | **Replace.** Each successful `POST` overwrites the stored export metadata and deletes the previous Cloudinary asset after the new upload succeeds. On failure, the previous export remains. |

---

## Routes

All routes require:

```http
Authorization: Bearer <worker-access-token>
```

Role must be `worker`.

### 1. Check export status (recommended for UI)

```http
GET /worker/profile/cv-export/status
```

**What it does**

- Tells the UI whether a generated CV already exists.
- Indicates if the profile changed since the last successful export (`isOutdated`).

**Request**

- No body.
- No query params.

**Success response** — `200 OK`, JSON:

```ts
type WorkerCvExportStatus = {
  available: boolean;
  documentId: string | null;
  fileName: string | null;
  generatedAt: string | null;              // ISO-8601
  sourceProfileUpdatedAt: string | null;   // ISO-8601 snapshot used at generation
  isOutdated: boolean;                     // true when profile.updatedAt > sourceProfileUpdatedAt
};
```

**Example — never exported**

```json
{
  "available": false,
  "documentId": null,
  "fileName": null,
  "generatedAt": null,
  "sourceProfileUpdatedAt": null,
  "isOutdated": false
}
```

**Example — export exists and profile unchanged**

```json
{
  "available": true,
  "documentId": "8f1c2b4a-9d3e-4f5a-b6c7-1234567890ab",
  "fileName": "joballa-cv-fabrice-mokfembam.pdf",
  "generatedAt": "2026-06-04T07:45:12.000Z",
  "sourceProfileUpdatedAt": "2026-06-04T07:40:00.000Z",
  "isOutdated": false
}
```

**Frontend usage**

- `available === false` → show **Export CV** (calls `POST`).
- `available === true && isOutdated === false` → show **Download CV** (calls `GET`).
- `available === true && isOutdated === true` → show **Export CV** (regenerate) and optionally **Download previous CV**.

---

### 2. Generate and download latest CV

```http
POST /worker/profile/cv-export
```

**What it does**

1. Loads the authenticated worker's full profile (work history, education, certifications, etc.).
2. Validates minimum fields.
3. Renders a PDF with PDFKit.
4. Uploads the PDF to Cloudinary.
5. Saves export metadata on `worker_profiles`.
6. Returns the **same PDF bytes** in the HTTP response (browser download starts immediately).

**Request**

- No body.

**Success response** — `201 Created`, **binary PDF**:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="joballa-cv-<safe-worker-name>.pdf"
X-Joballa-Document-Id: <uuid>
X-Joballa-Generated-At: <ISO-8601>

<PDF binary>
```

**Frontend fetch example**

```ts
const res = await fetch(`${API_URL}/worker/profile/cv-export`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
});

if (!res.ok) throw await res.json(); // JSON error body

const blob = await res.blob();
const fileName =
  res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ??
  'joballa-cv.pdf';

// trigger browser download
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = fileName;
a.click();
URL.revokeObjectURL(url);
```

**Error responses** — JSON:

```json
{
  "statusCode": 422,
  "code": "PROFILE_INSUFFICIENT_FOR_CV",
  "message": "Complete your name and professional summary before exporting your CV."
}
```

```json
{
  "statusCode": 500,
  "code": "CV_GENERATION_FAILED",
  "message": "We could not generate your CV. Please try again."
}
```

If generation or upload fails, the **previous** stored export (if any) is kept.

---

### 3. Download previously generated CV

```http
GET /worker/profile/cv-export
```

**What it does**

- Fetches the latest stored generated PDF from Cloudinary.
- Does **not** regenerate.
- Returns binary PDF for browser download.

**Request**

- No body.

**Success response** — `200 OK`, **binary PDF**:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="joballa-cv-<safe-worker-name>.pdf"

<PDF binary>
```

**Not found** — `404`, JSON:

```json
{
  "statusCode": 404,
  "code": "GENERATED_CV_NOT_FOUND",
  "message": "Generate your CV before downloading it."
}
```

**Frontend fetch example**

Same as `POST`, but use `method: 'GET'` and expect `200` instead of `201`.

---

## Separate from uploaded CV

| Route | Purpose |
| --- | --- |
| `POST /worker/profile/cv` | Worker **uploads** their own PDF resume (`cvUrl` on profile) |
| `POST /worker/profile/cv-export` | Joballa **generates** a PDF from profile data and stores it |
| `GET /worker/profile/cv-export` | Downloads the **generated** PDF only |

---

## PDF contents

**Included**

- Photo (when `photoUrl` loads successfully)
- Full name, professional title
- City, region, country
- Email and phone (worker's own contact info)
- Professional summary (`shortBio`)
- Languages, skills, preferred categories/types
- Work experience, education, certifications

**Excluded**

- KYC images / ID numbers
- Payment accounts
- Internal IDs, admin notes, applications

Empty sections are omitted (no blank headings).

---

## Database migration required

Apply before using in an environment:

```bash
npx prisma migrate deploy
```

Migration: `20260604120000_worker_generated_cv_export`

Adds to `worker_profiles`:

- `generated_cv_url`
- `generated_cv_public_id`
- `generated_cv_file_name`
- `generated_cv_document_id`
- `generated_cv_at`
- `generated_cv_source_profile_updated_at`

---

## Related docs

- Page-level contract: `FRONTEND_WORKER_ROUTES.md` (profile / CV export section)
- Full verified route index: `VERIFIED_API_INTEGRATION.md`
