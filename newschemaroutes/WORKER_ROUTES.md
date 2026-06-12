# WORKER ROUTES

This document defines the Worker portal routes and API contracts for rebuilding Joballa against the new database while preserving the current Worker UI as much as possible.

Admin is out of this frontend codebase. Worker-facing UI should show jobs normally, regardless of whether the job originated from an employer post, a department request, or an admin-created phone-in request.

## Worker Principles

- Worker portal is protected.
- Worker home redirects to job discovery.
- Worker applications use profile snapshots, not CV upload as the primary application asset.
- Worker can optionally upload CV to help build their profile and export a CV later.
- Worker verification is personal identity verification through KYC.
- All jobs appear together in search/listing.
- Payment-managed jobs can show a trust/payment badge, but should not become a separate browsing category.
- No shift log features. Engagement tracking exists, but shifts are intentionally removed.
- AI/recommendations are future-ready only. Keep nullable fields like `matchScore`; do not implement recommendation logic now.

## Worker Shared Data Shapes

### Worker Me

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
    verificationStatus: "not_submitted" | "pending" | "under_review" | "verified" | "rejected" | "changes_requested";
    profileCompleteness: number;
  };
};
```

### Job Card

```ts
type WorkerJobCard = {
  id: string;
  title: string;
  department: {
    id: string;
    name: string;
    slug: string;
    category: string;
  };
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

### Paginated Response

```ts
type Paginated<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
```

## Frontend Routes

### `/worker`

Worker root route.

What it does:

- Redirects to `/worker/jobs`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/worker/jobs`

Main worker home and job discovery route.

What it does:

- Shows searchable job list/grid.
- Includes filters for department, location, pay type, employment type, work mode, duration.
- Shows all active jobs in one list.
- Shows trust/payment badge when `paymentManagedByJoballa` is true.
- Opens selected job detail panel on desktop if UI supports it.

Sends to API:

`GET /worker/jobs`

Query:

```ts
type WorkerJobSearchQuery = {
  search?: string;
  departmentId?: string;
  departmentCategory?: string;
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

Notes:

- This should replace any hard split between formal/informal jobs.
- Only `active` jobs should be visible to workers.

### `/worker/jobs/search`

Mobile/search-mode job route.

What it does:

- Same data as `/worker/jobs`.
- UI can focus search input and filters.

Sends:

- Same as `/worker/jobs`.

Receives:

- Same as `/worker/jobs`.

### `/worker/jobs/[jobId]`

Job detail route.

What it does:

- Shows full job detail.
- Shows employer/department name.
- Shows verification/payment trust signals.
- Shows requested documents.
- Shows Apply with Profile button.
- If worker profile is below minimum completeness, disable apply and prompt profile completion.

Sends to API:

`GET /worker/jobs/:jobId`

Path:

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
  requestedDocuments: Array<{
    key: string;
    label: string;
    required: boolean;
    acceptedFileTypes: Array<"pdf" | "image">;
  }>;
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

### `/worker/jobs/[jobId]/apply`

Apply helper route.

What it does:

- Redirects to `/worker/jobs/[jobId]?apply=1` or opens apply flow for the job.

Sends:

- Nothing directly.

Receives:

- Redirect only.

### Apply with Profile flow

Usually opened from job detail rather than a separate page.

What it does:

- Fetches worker profile preview.
- Shows what the employer will receive.
- Lets worker add optional cover note.
- Lets worker attach requested/supporting documents.
- Submits application.

Sends to API:

`POST /worker/jobs/:jobId/apply`

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
  attachedDocuments?: unknown[];
  profileSnapshot: unknown;
  submittedAt: string;
  job: WorkerJobCard;
};
```

Backend side effect:

- Capture `profile_snapshot` at submission time.

### `/worker/saved-jobs`

Saved jobs route.

What it does:

- Shows jobs saved by worker.
- Allows unsave and bulk remove if UI supports it.

Sends to API:

`GET /worker/saved-jobs`

Query:

```ts
type SavedJobsQuery = WorkerJobSearchQuery;
```

Receives:

```ts
type SavedJobsResponse = Paginated<WorkerJobCard>;
```

Unsave:

`DELETE /worker/saved-jobs/:jobId`

Receives:

```ts
type EmptyResponse = { ok: true };
```

### Job actions from list/detail

Save job:

`POST /worker/jobs/:jobId/save`

Sends:

- Path `jobId`.

Receives:

```ts
type SaveJobResponse = {
  jobId: string;
  saved: true;
};
```

Unsave job:

`DELETE /worker/jobs/:jobId/save`

Receives:

```ts
type SaveJobResponse = {
  jobId: string;
  saved: false;
};
```

Hide job:

`POST /worker/jobs/:jobId/hide`

Receives:

```ts
type HideJobResponse = {
  jobId: string;
  hidden: true;
};
```

Unhide job:

`DELETE /worker/jobs/:jobId/hide`

Receives:

```ts
type HideJobResponse = {
  jobId: string;
  hidden: false;
};
```

Report job:

`POST /worker/jobs/:jobId/report`

Sends:

```ts
type ReportJobRequest = {
  reason: string;
};
```

Receives:

```ts
type ReportJobResponse = {
  id: string;
  jobId: string;
  message: string;
};
```

Share job:

`GET /worker/jobs/:jobId/share`

Receives:

```ts
type ShareLinkResponse = {
  url: string;
};
```

### `/worker/dashboard`

Worker dashboard route.

What it does:

- Shows welcome/profile status.
- Shows quick stats.
- Shows profile completeness.
- Shows recent applications.
- Can show a future-ready recommended jobs block, but recommendation logic is not required now.
- Shows entry action for "Need Someone?" informal job request.

Sends to API:

`GET /worker/dashboard`

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
  nextActions: Array<{
    key: string;
    label: string;
    href: string;
  }>;
};
```

Notes:

- `suggestedJobs` can be recent/high-quality jobs for now.
- Do not implement AI recommendation yet.

### `/worker/applications`

Worker applications route.

What it does:

- Shows applications submitted by worker.
- Filters by status.
- Opens application detail.

Sends to API:

`GET /worker/applications`

Query:

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

### `/worker/applications/search`

Application search route.

What it does:

- Same data as `/worker/applications`.
- UI can focus search/filter mode.

Sends:

- Same as `/worker/applications`.

Receives:

- Same as `/worker/applications`.

### `/worker/applications/[applicationId]`

Application detail route.

What it does:

- Shows submitted application, profile snapshot, attached documents, status, employer notes, and related job.

Sends to API:

`GET /worker/applications/:applicationId`

Receives:

```ts
type WorkerApplicationDetail = {
  id: string;
  status: "submitted" | "shortlisted" | "hired" | "rejected";
  coverNote?: string | null;
  employerNotes?: string | null;
  profileSnapshot: unknown;
  attachedDocuments?: unknown[];
  submittedAt: string;
  job: WorkerJobDetail;
};
```

Archive/delete from worker list:

`DELETE /worker/applications/:applicationId`

Receives:

```ts
type EmptyResponse = { ok: true };
```

### `/worker/engagements`

Worker engagements route.

What it does:

- Shows hired/active/completed/terminated work engagements.
- No shift logs.
- Shows job, payer/employer, dates, pay terms, status, and payment status summary.

Sends to API:

`GET /worker/engagements`

Query:

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

Engagement detail:

`GET /worker/engagements/:engagementId`

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

Worker earnings/payments route.

What it does:

- Shows total earnings.
- Shows transaction history.
- Filters by date range/status.
- Exports earnings statement.

Sends to API:

`GET /worker/earnings/summary`

Query:

```ts
type EarningsSummaryQuery = {
  from?: string;
  to?: string;
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
```

Transactions:

`GET /worker/earnings/transactions`

Query:

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

Earning transaction detail route.

Sends to API:

`GET /worker/earnings/transactions/:transactionId`

Receives:

```ts
type EarningTransactionDetail = EarningTransaction & {
  receiptNumber?: string | null;
  fapshiTransactionId?: string | null;
  failureReason?: string | null;
};
```

### Earnings statement export

Triggered from `/worker/earnings`.

Sends to API:

`GET /worker/earnings/statement`

Query:

```ts
type EarningsStatementQuery = {
  from: string;
  to: string;
  format?: "json" | "csv" | "pdf";
};
```

Receives:

- JSON rows for `json`.
- File response for `csv` or `pdf`.

### `/worker/payments`

Legacy route.

What it does:

- Redirects to `/worker/earnings`.

### `/worker/profile`

Worker profile preview route.

What it does:

- Shows worker how profile appears to employers.
- Shows verification/completeness state.
- Links to edit.

Sends to API:

`GET /worker/profile`

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
  yearsExperienceByCategory?: Record<string, number>;
  cvUrl?: string | null;
  profileCompleteness: number;
  profileCompletenessBreakdown?: unknown;
  verificationStatus: string;
  workExperiences: WorkerWorkExperience[];
  education: WorkerEducation[];
  certifications: WorkerCertification[];
  supportingDocuments: WorkerDocument[];
  paymentAccounts: WorkerPaymentAccount[];
};
```

### `/worker/profile/edit`

Worker profile editor route.

What it does:

- Edits personal info, summary, skills, work history, education, certifications, documents, payment accounts, CV upload, KYC.
- This is where profile data is collected, not signup.

Key API calls:

- `PUT /worker/profile`
- `PATCH /worker/profile/personal-info`
- `PATCH /worker/profile/professional-summary`
- `PATCH /worker/profile/skills`
- `POST /worker/profile/avatar`
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
- `POST /worker/profile/kyc`
- `GET /worker/profile/kyc`
- `POST /worker/profile/payment-accounts`
- `PATCH /worker/profile/payment-accounts/:accountId`
- `DELETE /worker/profile/payment-accounts/:accountId`

Profile save sends:

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

```ts
type WorkerProfileSaveResponse = WorkerFullProfile;
```

Document upload sends:

- `multipart/form-data`
- `file`
- `documentLabel?`

KYC sends:

```ts
type SubmitWorkerKycRequest = {
  kycType: "national_id" | "passport" | "drivers_license";
  frontUrl: string;
  backUrl?: string | null;
  selfieUrl: string;
};
```

Payment account sends:

```ts
type WorkerPaymentAccountRequest = {
  provider: "mtn_momo" | "orange_money";
  phoneNumber: string;
  isPrimary?: boolean;
};
```

### CV upload/prefill

Can be part of profile edit.

Sends to API:

`POST /worker/profile/cv`

Sends:

- `multipart/form-data`
- `file`

Receives:

```ts
type CvUploadResponse = {
  cvUrl: string;
  extractedFields?: Partial<UpdateWorkerProfileRequest>;
  message: string;
};
```

Notes:

- Prefill can be basic or disabled initially.
- Worker must review before saving extracted fields.

### CV export

Triggered from profile page/editor.

Sends to API:

`GET /worker/profile/cv-export`

Query:

```ts
type CvExportQuery = {
  locale?: "eng" | "fre";
};
```

Receives:

- PDF file response.

### `/worker/my-jobs`

Worker-owned/requested jobs route.

What it does:

- Shows jobs or informal job requests created by this worker through "Need Someone?"
- Since workers are not standard employers, this should focus on informal requests/requester jobs.

Sends to API:

`GET /worker/informal-requests`

Query:

```ts
type MyInformalRequestsQuery = {
  status?: "submitted" | "under_review" | "posted" | "rejected" | "changes_requested";
  page?: number;
  limit?: number;
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

type MyInformalRequestsResponse = Paginated<InformalJobRequestListItem>;
```

### `/worker/jobs/new`

Current route should become "Need Someone?" informal request creation.

What it does:

- Lets worker create a department-routed informal job request.
- Select department.
- Render department-specific form.
- Submit request.

Sends to API:

`POST /worker/informal-requests`

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
type CreateInformalJobResponse = {
  id: string;
  status: "submitted" | "under_review" | "posted" | "rejected";
  assignedJobId?: string | null;
  submissionScore?: {
    score: number;
    tier: "auto_approved" | "yellow_zone" | "flagged" | "auto_rejected";
  };
  message: string;
};
```

Notes:

- If auto-approved, backend may immediately create `jobs` row and return `assignedJobId`.
- Worker UI should still call it a request/posting flow, not expose admin queue language.

### `/worker/notifications`

Worker notifications route.

What it does:

- Shows in-app notification history.
- Filters by type.
- Marks notifications read.

Sends to API:

`GET /worker/notifications`

Query:

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

Mark read:

`PATCH /worker/notifications/:notificationId/read`

Receives:

```ts
type NotificationReadResponse = NotificationItem;
```

### `/worker/settings`

Worker settings route.

What it does:

- Language preference.
- Appearance/theme.
- Notification preferences.
- Account/sign out.

Sends to API:

`GET /worker/settings/notifications`

Receives:

```ts
type NotificationSettings = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  applicationUpdates: boolean;
  jobUpdates: boolean;
  paymentUpdates: boolean;
  engagementUpdates: boolean;
  securityAlerts: boolean;
  marketingUpdates: boolean;
};
```

Update:

`PATCH /worker/settings/notifications`

Sends:

```ts
type UpdateNotificationSettingsRequest = Partial<NotificationSettings>;
```

Receives:

```ts
type NotificationSettingsResponse = NotificationSettings;
```

Language:

`PATCH /worker/settings/language`

Sends:

```ts
type UpdateLanguageRequest = {
  preferredLanguage: "eng" | "fre";
};
```

Receives:

```ts
type UpdateLanguageResponse = {
  preferredLanguage: "eng" | "fre";
};
```

## Worker API Summary

Required endpoints:

- `GET /worker/me`
- `GET /worker/dashboard`
- `GET /worker/jobs`
- `GET /worker/jobs/:jobId`
- `POST /worker/jobs/:jobId/save`
- `DELETE /worker/jobs/:jobId/save`
- `POST /worker/jobs/:jobId/hide`
- `DELETE /worker/jobs/:jobId/hide`
- `POST /worker/jobs/:jobId/report`
- `GET /worker/jobs/:jobId/share`
- `POST /worker/jobs/:jobId/apply`
- `GET /worker/applications`
- `GET /worker/applications/:applicationId`
- `DELETE /worker/applications/:applicationId`
- `GET /worker/saved-jobs`
- `DELETE /worker/saved-jobs/:jobId`
- `GET /worker/engagements`
- `GET /worker/engagements/:engagementId`
- `GET /worker/earnings/summary`
- `GET /worker/earnings/transactions`
- `GET /worker/earnings/transactions/:transactionId`
- `GET /worker/earnings/statement`
- `GET /worker/profile`
- `PUT /worker/profile`
- `PATCH /worker/profile/personal-info`
- `PATCH /worker/profile/professional-summary`
- `PATCH /worker/profile/skills`
- `POST /worker/profile/avatar`
- `POST /worker/profile/cv`
- `GET /worker/profile/cv-export`
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
- `POST /worker/profile/kyc`
- `GET /worker/profile/kyc`
- `POST /worker/profile/payment-accounts`
- `PATCH /worker/profile/payment-accounts/:accountId`
- `DELETE /worker/profile/payment-accounts/:accountId`
- `GET /worker/informal-requests`
- `POST /worker/informal-requests`
- `GET /worker/notifications`
- `PATCH /worker/notifications/:notificationId/read`
- `GET /worker/settings/notifications`
- `PATCH /worker/settings/notifications`
- `PATCH /worker/settings/language`

Routes to remove or rework from old code:

- Employer-like shift endpoints should not be used.
- Worker-created job flow should become informal request flow unless bosses later confirm workers can post normal jobs.
