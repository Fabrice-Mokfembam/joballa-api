# FRONTEND WORKER ROUTES

This document is for the frontend team. It describes Worker portal pages, what each page does, which backend endpoint it calls, what it sends, and what it receives.

**Verified against the running API** — see `VERIFIED_API_INTEGRATION.md`. Worker routes use `/worker/*` (not `/api/worker/*`). Lists use `{ data, page, limit, total, totalPages }`.

All Worker API calls require a Bearer access token and the authenticated user must have role `worker`.

## Shared Worker Types

```ts
type Paginated<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type WorkerJobCard = {
  id: string;
  title: string;
  department: {
    id: string;
    name: string;
    slug: string;
    category: string;
  } | null;
  ownerName: string;
  ownerVerified: boolean;
  city: string;
  region?: string | null;
  country: string;
  employmentType: "full_time" | "part_time" | "contract" | "casual" | "seasonal" | "internship";
  workMode: "onsite" | "remote" | "hybrid";
  payAmount: number;
  payCurrency: "XAF";
  payStructure: "hourly" | "daily" | "weekly" | "monthly" | "fixed";
  duration?: string | null;
  status: "active";
  paymentManagedByJoballa: boolean;
  requiredSkills: string[];
  matchScore?: number | null;
  postedAt: string;
  savedByViewer?: boolean;
  hiddenByViewer?: boolean;
};
```

## Pages And API Contracts

### Session bootstrap — `GET /worker/me`

Call after login (or with `GET /auth/me` then this for worker-specific profile fields).

Sends: Bearer token only.

Receives:

```ts
type WorkerMe = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "worker";
  preferredLanguage: "eng" | "fre";
  accountStatus: "active" | "suspended" | "deactivated";
  workerProfile: {
    id: string;
    fullName: string | null;
    professionalTitle: string | null;
    photoUrl: string | null;
    verificationStatus: string;
    profileCompleteness: number;
  };
};
```

### `/worker`

What it does:

- Worker root.
- Redirects to `/worker/jobs`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/worker/jobs`

What it does:

- Main worker job discovery page.
- Shows all active jobs in one feed.
- Supports search, filters, save, hide, report, and apply entry points.

API:

- `GET /worker/jobs`

Sends:

```ts
type WorkerJobSearchQuery = {
  search?: string;
  departmentId?: string;
  city?: string;
  region?: string;
  employmentType?: string;
  workMode?: string;
  payStructure?: string;
  minPay?: number;
  maxPay?: number;
  sort?: "recent" | "highest_pay" | "nearest";
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type WorkerJobsResponse = Paginated<WorkerJobCard>;
```

### `/worker/jobs/search`

What it does:

- Mobile/search-focused job discovery view.
- Uses the same data contract as `/worker/jobs`.

API:

- `GET /worker/jobs/search`

Sends:

- Same as `WorkerJobSearchQuery`.

Receives:

- Same as `WorkerJobsResponse`.

### `/worker/jobs/[jobId]`

What it does:

- Shows job detail.
- Shows owner, requested documents, trust signals, and viewer application state.
- Opens Apply with Profile flow.

API:

- `GET /worker/jobs/:jobId`

Sends:

```ts
type JobDetailParams = {
  jobId: string;
};
```

Receives:

```ts
type WorkerJobDetail = WorkerJobCard & {
  description: string;
  requirements: string[];
  responsibilities: string[];
  requestedDocuments: unknown[];
  numberOfOpenings: number;
  startDate?: string | null;
  startNow: boolean;
  owner: {
    id: string;
    displayName: string;
    verified: boolean;
    photoUrl?: string | null;
  };
  viewerApplication?: {
    id: string;
    status: "submitted" | "shortlisted" | "hired" | "rejected";
  } | null;
};
```

### Apply With Profile

What it does:

- Submits an application using the worker profile snapshot.
- Optional cover note and supporting/requested documents can be attached.

API:

- `POST /worker/jobs/:jobId/apply`

Sends:

```ts
type ApplyToJobRequest = {
  coverNote?: string;
  attachedDocuments?: Array<{
    requestedDocumentKey?: string;
    supportingDocumentId?: string;
    fileUrl?: string;
    fileName?: string;
  }>;
};
```

Receives:

```ts
type WorkerApplicationDetail = {
  id: string;
  jobId: string;
  workerId: string;
  status: "submitted" | "shortlisted" | "hired" | "rejected";
  coverNote?: string | null;
  employerNotes?: string | null;
  attachedDocuments?: unknown[];
  profileSnapshot: unknown;
  submittedAt: string;
  job: WorkerJobCard | WorkerJobDetail;
};
```

### Job Actions

What they do:

- Save, unsave, hide, unhide, report, or share a job from list/detail UI.

APIs:

- `POST /worker/jobs/:jobId/save`
- `DELETE /worker/jobs/:jobId/save`
- `POST /worker/jobs/:jobId/hide`
- `DELETE /worker/jobs/:jobId/hide`
- `POST /worker/jobs/:jobId/report`
- `GET /worker/jobs/:jobId/share`

Sends:

```ts
type ReportJobRequest = {
  reason: string;
};
```

Receives:

```ts
type SaveJobResponse = {
  jobId: string;
  saved: boolean;
};

type HideJobResponse = {
  jobId: string;
  hidden: boolean;
};

type ReportJobResponse = {
  id: string;
  jobId: string;
  message: string;
};

type ShareLinkResponse = {
  url: string;
};
```

### `/worker/dashboard`

What it does:

- Shows worker summary, recent applications, suggested jobs, and next actions.

API:

- `GET /worker/dashboard`

Sends:

- Nothing beyond auth token.

Receives:

```ts
type WorkerDashboard = {
  welcomeName: string;
  verificationStatus: string;
  profileCompleteness: number;
  stats: {
    totalEarnings: number;
    activeApplications: number;
    jobsCompleted: number;
    savedJobs: number;
  };
  recentApplications: WorkerApplicationListItem[];
  suggestedJobs: WorkerJobCard[];
  nextActions: Array<{ key: string; label: string; href: string }>;
};
```

### `/worker/applications`

What it does:

- Lists applications submitted by the worker.
- Supports status filter and search UI.

API:

- `GET /worker/applications`

Sends:

```ts
type WorkerApplicationsQuery = {
  status?: "submitted" | "shortlisted" | "hired" | "rejected";
  search?: string;
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type WorkerApplicationListItem = {
  id: string;
  status: "submitted" | "shortlisted" | "hired" | "rejected";
  submittedAt: string;
  job: WorkerJobCard;
  employerNotes?: string | null;
};

type WorkerApplicationsResponse = Paginated<WorkerApplicationListItem>;
```

### `/worker/applications/[applicationId]`

What it does:

- Shows full application detail.
- Allows worker to remove/archive the application from their list.

APIs:

- `GET /worker/applications/:applicationId`
- `DELETE /worker/applications/:applicationId`

Sends:

```ts
type ApplicationParams = {
  applicationId: string;
};
```

Receives:

```ts
type DeleteResponse = {
  ok: true;
};
```

GET receives `WorkerApplicationDetail`.

### `/worker/saved-jobs`

What it does:

- Shows worker saved jobs.
- Allows unsave.

APIs:

- `GET /worker/saved-jobs`
- `DELETE /worker/saved-jobs/:jobId`

Sends:

- Same query shape as `WorkerJobSearchQuery`.

Receives:

```ts
type SavedJobsResponse = Paginated<WorkerJobCard>;
```

DELETE receives:

```ts
type RemoveSavedJobResponse = {
  jobId: string;
  saved: false;
};
```

### `/worker/engagements`

What it does:

- Lists hired, active, completed, or terminated engagements.
- No shift log UI.

API:

- `GET /worker/engagements`

Sends:

```ts
type WorkerEngagementsQuery = {
  status?: "active" | "completed" | "terminated";
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type WorkerEngagementListItem = {
  id: string;
  engagementId: string;
  jobId: string;
  jobTitle: string;
  payerName: string;
  startDate: string;
  endDate?: string | null;
  status: "active" | "completed" | "terminated";
  payRate: number;
  payCurrency: "XAF";
  payStructure: string;
  paymentManagedByJoballa: boolean;
};

type WorkerEngagementsResponse = Paginated<WorkerEngagementListItem>;
```

### `/worker/engagements/[engagementId]`

What it does:

- Shows engagement detail and related payments.

API:

- `GET /worker/engagements/:engagementId`

Receives:

```ts
type WorkerEngagementDetail = WorkerEngagementListItem & {
  description?: string | null;
  taskNotes?: string | null;
  terminationReason?: string | null;
  payments: EarningTransaction[];
};
```

### `/worker/earnings`

What it does:

- Shows earnings totals and transaction history.

APIs:

- `GET /worker/earnings/summary`
- `GET /worker/earnings/transactions`
- `GET /worker/earnings/statement`

Sends:

```ts
type EarningsTransactionsQuery = {
  status?: "pending" | "completed" | "failed" | "refunded";
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type EarningsSummary = {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  currency: "XAF";
};

type EarningTransaction = {
  id: string;
  engagementId: string;
  jobTitle: string;
  payerName: string;
  amount: number;
  currency: "XAF";
  provider: "mtn_momo" | "orange_money";
  recipientNumber: string;
  status: "pending" | "completed" | "failed" | "refunded";
  initiatedAt: string;
  completedAt?: string | null;
};
```

### `/worker/earnings/[transactionId]`

What it does:

- Shows one earning transaction.

API:

- `GET /worker/earnings/transactions/:transactionId`

Receives:

```ts
type EarningTransactionDetail = EarningTransaction & {
  receiptNumber?: string | null;
  fapshiTransactionId?: string | null;
  failureReason?: string | null;
};
```

### `/worker/profile`

What it does:

- Shows profile preview as employers will see it.

API:

- `GET /worker/profile`

Receives:

```ts
type WorkerFullProfile = {
  id: string;
  userId: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  professionalTitle?: string | null;
  shortBio?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  languages: string[];
  skills: string[];
  preferredJobCategories: string[];
  preferredJobTypes: string[];
  availabilityStatus?: string | null;
  yearsExperienceByCategory?: unknown;
  cvUrl?: string | null;
  profileCompleteness: number;
  profileCompletenessBreakdown?: unknown;
  verificationStatus: string;
  workExperiences: unknown[];
  education: unknown[];
  certifications: unknown[];
  supportingDocuments: unknown[];
  paymentAccounts: unknown[];
  latestKyc?: unknown;
};
```

### `/worker/profile/edit`

What it does:

- Edits worker profile, work history, education, certifications, documents, KYC, CV, avatar, and payment accounts.

Main APIs:

- `PUT /worker/profile`
- `PATCH /worker/profile/personal-info`
- `PATCH /worker/profile/professional-summary`
- `PATCH /worker/profile/skills`
- `POST /worker/profile/avatar`
- `POST /worker/profile/cv` — worker-uploaded resume PDF
- `GET /worker/profile/cv-export/status` — export metadata for UI
- `POST /worker/profile/cv-export` — generate + download PDF
- `GET /worker/profile/cv-export` — download last generated PDF

`POST /worker/profile/cv`: `multipart/form-data`, field name `file`, **PDF only** (`application/pdf`, max 5 MB). Returns `{ cvUrl, message }`.

### Generated CV export (Joballa-built PDF)

See **`BACKEND_RESPONSE_WORKER_CV_EXPORT.md`** for the full contract. Summary:

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/worker/profile/cv-export/status` | JSON `WorkerCvExportStatus` |
| POST | `/worker/profile/cv-export` | **PDF binary** (`201`) — generates, stores, downloads |
| GET | `/worker/profile/cv-export` | **PDF binary** (`200`) — downloads stored export |

**Minimum fields before `POST`:** `fullName` (or first+last) and `shortBio`.

**Frontend:** use `fetch` + `blob()` + programmatic `<a download>` — do not expect JSON from export routes.

**UI hint:** call `GET /status` first — use `available` and `isOutdated` to choose **Export CV** vs **Download CV**.

Profile sends:

```ts
type UpdateWorkerProfileRequest = Partial<{
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  professionalTitle: string;
  shortBio: string;
  country: string;
  region: string;
  city: string;
  languages: string[];
  skills: string[];
  preferredJobCategories: string[];
  preferredJobTypes: string[];
  availabilityStatus: string;
  yearsExperienceByCategory: Record<string, number>;
}>;
```

Receives:

- `WorkerFullProfile`

Upload sends:

- `multipart/form-data`
- Field name: `file`
- For documents, optional `documentLabel`

### Worker Profile Collections

What they do:

- Manage repeated profile items.

APIs:

- `POST /worker/profile/work-history`
- `PATCH /worker/profile/work-history/:workId`
- `DELETE /worker/profile/work-history/:workId`
- `POST /worker/profile/education`
- `PATCH /worker/profile/education/:educationId`
- `DELETE /worker/profile/education/:educationId`
- `POST /worker/profile/certifications`
- `PATCH /worker/profile/certifications/:certificationId`
- `DELETE /worker/profile/certifications/:certificationId`
- `POST /worker/profile/documents`
- `GET /worker/profile/documents`
- `DELETE /worker/profile/documents/:documentId`

Receives:

- Created item, updated full profile, list, or `{ ok: true }` depending action.

### Worker KYC

What it does:

- Submits and reads personal verification status.

APIs:

- `POST /worker/profile/kyc`
- `GET /worker/profile/kyc`

Sends:

```ts
type SubmitWorkerKycRequest = {
  kycType: "national_id" | "passport" | "drivers_license";
  frontUrl: string;
  backUrl?: string | null;
  selfieUrl: string;
};
```

Receives:

- Latest KYC submission/status object.

### Worker Payment Accounts

What it does:

- Adds and manages mobile money accounts used to receive payments.

APIs:

- `POST /worker/profile/payment-accounts`
- `PATCH /worker/profile/payment-accounts/:accountId`
- `DELETE /worker/profile/payment-accounts/:accountId`

Sends:

```ts
type WorkerPaymentAccountRequest = {
  provider: "mtn_momo" | "orange_money";
  phoneNumber: string;
  isPrimary?: boolean;
};
```

Receives:

- Created account, full profile, or `{ ok: true }`.

### `/worker/my-jobs` and `/worker/jobs/new`

What they do:

- Worker-created posting flow is an informal request flow.
- `/worker/my-jobs` lists informal requests.
- `/worker/jobs/new` creates an informal request.

APIs:

- `GET /worker/informal-requests`
- `POST /worker/informal-requests`

Sends:

```ts
type CreateInformalJobRequest = {
  departmentId: string;
  departmentCategory: "education" | "domestic" | "logistics" | "events" | "agriculture" | "construction" | "other";
  formData: Record<string, unknown>;
  paymentManagedByJoballa: boolean;
};
```

Receives:

```ts
type InformalJobRequestListItem = {
  id: string;
  department: { id: string; name: string; category: string };
  title: string;
  paymentManagedByJoballa: boolean;
  status: "submitted" | "under_review" | "posted" | "rejected" | "changes_requested";
  assignedJobId?: string | null;
  rejectionReason?: string | null;
  changeRequest?: string | null;
  createdAt: string;
};
```

### `/worker/notifications`

What it does:

- Shows notifications and marks them read.

APIs:

- `GET /worker/notifications`
- `PATCH /worker/notifications/:notificationId/read`

Sends:

```ts
type NotificationsQuery = {
  type?: string;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  relatedType?: string | null;
  relatedId?: string | null;
  createdAt: string;
};
```

### `/worker/settings`

What it does:

- Manages language and notification preferences.

APIs:

- `GET /worker/settings/notifications`
- `PATCH /worker/settings/notifications`
- `PATCH /worker/settings/language`

Sends:

```ts
type UpdateNotificationSettingsRequest = Partial<{
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  applicationUpdates: boolean;
  jobUpdates: boolean;
  paymentUpdates: boolean;
  engagementUpdates: boolean;
  securityAlerts: boolean;
  marketingUpdates: boolean;
}>;

type UpdateLanguageRequest = {
  preferredLanguage: "eng" | "fre";
};
```

Receives:

- Notification settings object or `{ preferredLanguage: "eng" | "fre" }`.
