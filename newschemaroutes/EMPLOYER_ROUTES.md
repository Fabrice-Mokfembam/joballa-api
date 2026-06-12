# EMPLOYER ROUTES

This document defines the Employer portal routes and API contracts for rebuilding Joballa against the new database while preserving the current Employer UI as much as possible.

Admin is out of this frontend codebase. Employer UI can still show review status, rejection reasons, and change requests because those affect employer flows.

## Employer Principles

- Employer portal is protected.
- Employer signup remains simple: role + email or phone + password only.
- Company/contact/business verification details are completed inside the employer portal.
- Employer can post standard jobs.
- Employer can also use "Need Someone?" / informal request flow when the need should route through a Joballa department.
- Workers see all active listings as jobs, regardless of origin.
- Job submission may auto-approve, go under review, be flagged, be rejected, or request changes.
- No shift log features. Workforce exists, but shift tables/routes should not be rebuilt.
- Payments are based on engagements and payment records, not shifts.
- AI matching is future-ready only. Keep nullable `matchScore`, but do not implement AI matching now.

## Employer Shared Data Shapes

### Employer Me

```ts
type EmployerMe = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "employer";
  preferredLanguage: "eng" | "fre";
  accountStatus: "active" | "suspended" | "deactivated";
  employerProfile: {
    id: string;
    companyName: string | null;
    companyLogoUrl: string | null;
    contactPersonName: string | null;
    verificationStatus: "not_submitted" | "pending" | "under_review" | "verified" | "rejected" | "changes_requested";
  };
};
```

### Employer Job Card

```ts
type EmployerJobCard = {
  id: string;
  title: string;
  department: {
    id: string;
    name: string;
    slug: string;
    category: string;
  };
  city: string;
  region?: string | null;
  country: string;
  employmentType: "full_time" | "part_time" | "contract" | "casual" | "seasonal" | "internship";
  workMode: "onsite" | "remote" | "hybrid";
  payAmount: number;
  payCurrency: "XAF";
  payStructure: "hourly" | "daily" | "weekly" | "monthly" | "fixed";
  status: "draft" | "under_review" | "active" | "paused" | "closed" | "rejected";
  paymentManagedByJoballa: boolean;
  applicantsCount: number;
  shortlistedCount: number;
  hiredCount: number;
  submissionTier?: "auto_approved" | "yellow_zone" | "flagged" | "auto_rejected" | null;
  rejectionReason?: string | null;
  changeRequest?: string | null;
  createdAt: string;
  approvedAt?: string | null;
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

### `/employer`

Employer dashboard route.

What it does:

- Shows quick stats.
- Shows active job overview.
- Shows recent applicants.
- Shows quick actions: Post a Job, View Applicants, Manage Workers, Payroll, Need Someone.
- Shows company verification status and profile completion prompts.

Sends to API:

`GET /employer/dashboard`

Receives:

```ts
type EmployerDashboard = {
  companyName: string | null;
  verificationStatus: string;
  stats: {
    activeJobs: number;
    totalApplicants: number;
    hiredWorkers: number;
    totalPayroll: number;
    currency: "XAF";
  };
  activeJobs: EmployerJobCard[];
  recentApplicants: EmployerApplicantListItem[];
  nextActions: Array<{
    key: string;
    label: string;
    href: string;
  }>;
};
```

### `/employer/jobs`

Employer jobs route.

What it does:

- Shows employer-owned jobs.
- Shows statuses: draft, under review, active, paused, closed, rejected.
- Shows rejection/change-request messages where relevant.
- Lets employer open details, edit/draft, pause/close/delete if allowed.

Sends to API:

`GET /employer/jobs`

Query:

```ts
type EmployerJobsQuery = {
  status?: "draft" | "under_review" | "active" | "paused" | "closed" | "rejected";
  search?: string;
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type EmployerJobsResponse = Paginated<EmployerJobCard>;
```

### `/employer/jobs/new`

Post a job route.

What it does:

- Lets employer create a standard job.
- Select department.
- Fill job basics/details.
- Add requested documents if needed.
- Preview and submit.
- Backend validates and scores submission.
- Result may be active immediately, under review, rejected, or changes requested.

Sends to API:

`POST /employer/jobs`

```ts
type CreateEmployerJobRequest = {
  departmentId: string;
  title: string;
  employmentType: "full_time" | "part_time" | "contract" | "casual" | "seasonal" | "internship";
  workMode: "onsite" | "remote" | "hybrid";
  country: string;
  region?: string;
  city: string;
  neighbourhood?: string;
  payAmount: number;
  payCurrency?: "XAF";
  payStructure: "hourly" | "daily" | "weekly" | "monthly" | "fixed";
  experienceLevel?: string;
  startDate?: string | null;
  startNow: boolean;
  duration?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  requiredSkills: string[];
  requestedDocuments?: Array<{
    key: string;
    label: string;
    required: boolean;
    acceptedFileTypes: Array<"pdf" | "image">;
  }>;
  numberOfOpenings: number;
  asDraft?: boolean;
};
```

Receives:

```ts
type CreateEmployerJobResponse = {
  jobId: string;
  status: "draft" | "under_review" | "active" | "rejected";
  submissionScore?: {
    score: number;
    tier: "auto_approved" | "yellow_zone" | "flagged" | "auto_rejected";
  };
  rejectionReason?: string | null;
  changeRequest?: string | null;
  message: string;
};
```

Notes:

- If `asDraft` is true, scoring should not publish the job yet.
- If auto-approved, status can return `active`.
- If yellow/flagged, status should return `under_review`.

### `/employer/jobs/[jobId]`

Employer job detail route.

What it does:

- Shows full job details.
- Shows applicants summary.
- Shows review/scoring status where applicable.
- Lets employer edit status when allowed.

Sends to API:

`GET /employer/jobs/:jobId`

Receives:

```ts
type EmployerJobDetail = EmployerJobCard & {
  description: string;
  requirements: string[];
  responsibilities: string[];
  requiredSkills: string[];
  requestedDocuments?: unknown[];
  numberOfOpenings: number;
  startDate?: string | null;
  startNow: boolean;
  adminNotes?: string | null;
};
```

Update job:

`PATCH /employer/jobs/:jobId`

Sends:

```ts
type UpdateEmployerJobRequest = Partial<CreateEmployerJobRequest>;
```

Receives:

```ts
type UpdateEmployerJobResponse = EmployerJobDetail;
```

Update status:

`PATCH /employer/jobs/:jobId/status`

Sends:

```ts
type UpdateEmployerJobStatusRequest = {
  status: "draft" | "under_review" | "active" | "paused" | "closed";
};
```

Receives:

```ts
type UpdateEmployerJobStatusResponse = EmployerJobDetail;
```

Delete:

`DELETE /employer/jobs/:jobId`

Receives:

```ts
type EmptyResponse = { ok: true };
```

### Job draft save

Triggered from job form.

Sends to API:

`POST /employer/jobs/:jobId/draft`

Sends:

```ts
type SaveEmployerJobDraftRequest = Partial<CreateEmployerJobRequest>;
```

Receives:

```ts
type EmployerJobDraftResponse = EmployerJobDetail;
```

### `/employer/applicants`

Applicant review route.

What it does:

- Shows applicants for employer jobs.
- Search/filter by job and status.
- Supports grid/list/table views.
- Opens applicant detail panel/page.

Sends to API:

`GET /employer/applicants`

Query:

```ts
type EmployerApplicantsQuery = {
  search?: string;
  jobId?: string;
  status?: "submitted" | "shortlisted" | "hired" | "rejected";
  sort?: "recent" | "match" | "status";
  view?: "grid" | "list";
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type EmployerApplicantListItem = {
  id: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  workerId: string;
  workerName: string;
  workerHeadline?: string | null;
  workerPhotoUrl?: string | null;
  workerLocation?: string | null;
  topSkills: string[];
  verificationStatus: string;
  availabilityStatus?: string | null;
  status: "submitted" | "shortlisted" | "hired" | "rejected";
  matchScore?: number | null;
  submittedAt: string;
  workerEmail?: string | null;
};

type EmployerApplicantsResponse = Paginated<EmployerApplicantListItem>;
```

Applicant filters:

`GET /employer/applicants/filters`

Receives:

```ts
type EmployerApplicantFilters = {
  jobs: Array<{ id: string; title: string }>;
  statuses: string[];
};
```

### `/employer/applicants/[applicantId]`

Applicant detail route.

What it does:

- Shows application detail.
- Shows `profileSnapshot`, not the live worker profile as source of truth.
- Shows cover note and attached documents.
- Lets employer shortlist, reject, hire.
- Lets employer write notes.

Sends to API:

`GET /employer/applicants/:applicationId`

Receives:

```ts
type ApplicantProfileSnapshot = {
  fullName: string;
  headline?: string | null;
  professionalTitle?: string | null;
  avatarUrl?: string | null;
  verificationStatus?: string;
  location?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  phone?: string | null;
  languages?: string | null;
  languagesSpoken?: string[];
  summary?: string | null;
  professionalSummary?: string | null;
  bio?: string | null;
  industries?: string | string[];
  availability?: string | null;
  preferredJobTypes?: string[];
  availabilityStatus?: string | null;
  skills: string[];
  highlightedSkills?: string[];
  workHistory?: unknown[];
  workHistories?: unknown[];
  educations?: Array<{
    institution: string;
    degree?: string | null;
    fieldOfStudy?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    period?: string;
    description?: string | null;
    city?: string | null;
    region?: string | null;
  }>;
  documents?: Array<{ name: string; fileName?: string; type?: string; url?: string }>;
  snapshotAt?: string;
};

type EmployerApplicantDetail = EmployerApplicantListItem & {
  coverNote?: string | null;
  jobSpecificNote?: string | null;
  employerNotes?: string | null;
  attachedDocuments?: Array<{
    name: string;
    fileName?: string;
    type?: string;
    size?: string | number | null;
    url?: string;
    requestedDocumentKey?: string;
    fileUrl?: string;
  }>;
  profileSnapshot: ApplicantProfileSnapshot;
  job: EmployerJobDetail;
};
```

Update applicant status:

`PATCH /employer/applicants/:applicationId/status`

Sends:

```ts
type UpdateApplicantStatusRequest = {
  status: "shortlisted" | "hired" | "rejected";
  note?: string;
};
```

Receives:

```ts
type UpdateApplicantStatusResponse = EmployerApplicantDetail;
```

Important side effect:

- When status becomes `hired`, backend should create a `work_engagements` row if one does not already exist.

Update notes:

`PATCH /employer/applicants/:applicationId/notes`

Sends:

```ts
type UpdateApplicantNotesRequest = {
  employerNotes: string;
};
```

Receives:

```ts
type UpdateApplicantNotesResponse = {
  applicationId: string;
  employerNotes: string;
};
```

Share applicant:

`GET /employer/applicants/:applicationId/share`

Receives:

```ts
type ApplicantShareResponse = {
  url: string;
};
```

### `/employer/workforce`

Employer workforce route.

What it does:

- Shows hired workers/engagements.
- No shift log UI.
- Allows status filtering.
- Opens worker engagement detail.
- Allows ending engagement with reason.

Sends to API:

`GET /employer/workforce`

Query:

```ts
type EmployerWorkforceQuery = {
  status?: "active" | "completed" | "terminated";
  search?: string;
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type EmployerWorkforceListItem = {
  id: string;
  engagementId: string;
  workerId: string;
  workerName: string;
  workerPhotoUrl?: string | null;
  jobId: string;
  jobTitle: string;
  roleLabel?: string | null;
  startDate: string;
  endDate?: string | null;
  status: "active" | "completed" | "terminated";
  payRate: number;
  payCurrency: "XAF";
  payStructure: string;
  paymentManagedByJoballa: boolean;
};

type EmployerWorkforceResponse = Paginated<EmployerWorkforceListItem>;
```

### `/employer/workforce/[workerId]`

Worker/engagement detail route.

What it does:

- Shows hired worker profile snapshot/current public profile where allowed.
- Shows engagement details.
- Shows payment history for that engagement.
- Allows complete/terminate engagement.
- No shift logs.

Sends to API:

`GET /employer/workforce/:workerId`

Receives:

```ts
type EmployerWorkforceWorkerDetail = EmployerWorkforceListItem & {
  profileSnapshot?: unknown;
  publicProfile?: unknown;
  taskNotes?: string | null;
  terminationReason?: string | null;
  payments: EmployerPaymentHistoryItem[];
};
```

Update engagement status:

`PATCH /employer/workforce/:workerId/status`

Sends:

```ts
type UpdateWorkforceStatusRequest = {
  engagementId: string;
  status: "active" | "completed" | "terminated";
  reason?: string;
};
```

Receives:

```ts
type UpdateWorkforceStatusResponse = EmployerWorkforceWorkerDetail;
```

Routes/endpoints not to rebuild:

- `GET /employer/workforce/:workerId/shifts`
- `POST /employer/workforce/:workerId/shifts`
- `PATCH /employer/workforce/:workerId/shifts/:shiftId`
- `DELETE /employer/workforce/:workerId/shifts/:shiftId`

Reason:

- Shift table was intentionally removed.

### `/employer/payroll`

Employer payments/payroll route.

What it does:

- Shows payment overview.
- Shows workers/engagements with amounts due or payable.
- Allows paying worker when payment is managed by Joballa.
- Shows payment history.
- Exports payment history.

Sends to API:

`GET /employer/payments`

Query:

```ts
type EmployerPaymentsSummaryQuery = {
  month?: number;
  year?: number;
};
```

Receives:

```ts
type EmployerPaymentsSummary = {
  totalPayroll: number;
  pending: number;
  paidThisMonth: number;
  outstanding: number;
  currency: "XAF";
};
```

Workers to pay:

`GET /employer/payments/workers`

Query:

```ts
type EmployerPaymentWorkersQuery = {
  month?: number;
  year?: number;
};
```

Receives:

```ts
type EmployerPayWorkerItem = {
  engagementId: string;
  workerId: string;
  workerName: string;
  jobTitle: string;
  amountDue: number;
  currency: "XAF";
  provider: "mtn_momo" | "orange_money";
  recipientNumber: string;
  paymentManagedByJoballa: boolean;
  alreadyPaid: boolean;
};
```

Pay worker:

`POST /employer/payments/pay`

Sends:

```ts
type PayWorkerRequest = {
  engagementId: string;
  workerId: string;
  amount: number;
  provider: "mtn_momo" | "orange_money";
  recipientNumber: string;
  payPeriod?: string;
  idempotencyKey: string;
};
```

Receives:

```ts
type PayWorkerResponse = {
  paymentId: string;
  status: "pending" | "completed" | "failed";
  message: string;
};
```

Payment history:

`GET /employer/payments/history`

Query:

```ts
type EmployerPaymentHistoryQuery = {
  search?: string;
  status?: "pending" | "completed" | "failed" | "refunded";
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};
```

Receives:

```ts
type EmployerPaymentHistoryItem = {
  id: string;
  engagementId: string;
  workerId: string;
  workerName: string;
  jobTitle: string;
  amount: number;
  currency: "XAF";
  status: "pending" | "completed" | "failed" | "refunded";
  provider: "mtn_momo" | "orange_money";
  initiatedAt: string;
  completedAt?: string | null;
};
```

Payment detail:

`GET /employer/payments/:paymentId`

Receives:

```ts
type EmployerPaymentDetail = EmployerPaymentHistoryItem & {
  receiptNumber?: string | null;
  fapshiTransactionId?: string | null;
  failureReason?: string | null;
};
```

Statement/export:

`GET /employer/payments/statement`

Query:

```ts
type EmployerPaymentStatementQuery = {
  from: string;
  to: string;
  format?: "json" | "csv" | "pdf";
};
```

Receives:

- JSON rows or file response.

### `/employer/profile`

Company profile preview route.

What it does:

- Shows company/organisation profile.
- Shows business verification status.
- Shows documents status.
- Links to edit.

Sends to API:

`GET /employer/company`

Receives:

```ts
type EmployerCompany = {
  id: string;
  userId: string;
  companyName: string | null;
  companyLogoUrl?: string | null;
  companySize?: string | null;
  industry?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  website?: string | null;
  description?: string | null;
  tagline?: string | null;
  contactPersonName: string | null;
  contactPersonTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  paymentProvider?: "mtn_momo" | "orange_money" | null;
  paymentAccount?: string | null;
  verificationStatus: string;
  documents: EmployerDocument[];
};
```

### `/employer/profile/edit`

Company profile editor route.

What it does:

- Edits company identity.
- Edits employer contact person details.
- Uploads logo.
- Uploads business verification documents.
- Edits outgoing payment settings.

Sends to API:

`PATCH /employer/company`

```ts
type UpdateEmployerCompanyRequest = Partial<{
  companyName: string;
  companySize: string;
  industry: string;
  country: string;
  region: string;
  city: string;
  website: string;
  description: string;
  tagline: string;
  contactPersonName: string;
  contactPersonTitle: string;
  contactEmail: string;
  contactPhone: string;
  paymentProvider: "mtn_momo" | "orange_money";
  paymentAccount: string;
}>;
```

Receives:

```ts
type UpdateEmployerCompanyResponse = EmployerCompany;
```

Logo upload:

`POST /employer/company/logo`

Sends:

- `multipart/form-data`
- `file`

Receives:

```ts
type EmployerLogoUploadResponse = EmployerCompany;
```

Business document upload:

`POST /employer/company/documents`

Sends:

- `multipart/form-data`
- `file`
- `documentName`

Receives:

```ts
type EmployerDocument = {
  id: string;
  documentName: string;
  documentUrl: string;
  documentType: "pdf" | "image";
  verificationStatus: "not_submitted" | "pending" | "under_review" | "verified" | "rejected" | "changes_requested";
  verificationNotes?: string | null;
  createdAt: string;
};
```

Delete document:

`DELETE /employer/company/documents/:documentId`

Receives:

```ts
type EmptyResponse = { ok: true };
```

### `/employer/notifications`

Employer notifications route.

What it does:

- Shows notification history.
- Filters by type.
- Marks notifications read.

Sends to API:

`GET /employer/notifications`

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

`PATCH /employer/notifications/:notificationId/read`

Receives:

```ts
type NotificationReadResponse = NotificationItem;
```

### `/employer/settings`

Employer settings route.

What it does:

- Language preference.
- Appearance/theme.
- Notification preferences.
- Account/sign out.

Sends to API:

`GET /employer/settings/notifications`

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

`PATCH /employer/settings/notifications`

Sends:

```ts
type UpdateNotificationSettingsRequest = Partial<NotificationSettings>;
```

Receives:

```ts
type NotificationSettingsResponse = NotificationSettings;
```

Language:

`PATCH /employer/settings/language`

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

### Employer "Need Someone?" informal request flow

This can live as a modal or a route. If a route is needed, use:

`/employer/requests/new`

What it does:

- Lets employer create a department-routed informal request.
- Different from standard `/employer/jobs/new`.
- Select department.
- Render department-specific request form.
- Submit request.

Sends to API:

`POST /employer/informal-requests`

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

List employer requests:

`GET /employer/informal-requests`

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

## Employer API Summary

Required endpoints:

- `GET /employer/me`
- `GET /employer/dashboard`
- `GET /employer/jobs`
- `POST /employer/jobs`
- `GET /employer/jobs/:jobId`
- `PATCH /employer/jobs/:jobId`
- `PATCH /employer/jobs/:jobId/status`
- `POST /employer/jobs/:jobId/draft`
- `DELETE /employer/jobs/:jobId`
- `GET /employer/applicants/filters`
- `GET /employer/applicants`
- `GET /employer/applicants/:applicationId`
- `PATCH /employer/applicants/:applicationId/status`
- `PATCH /employer/applicants/:applicationId/notes`
- `GET /employer/applicants/:applicationId/share`
- `GET /employer/workforce`
- `GET /employer/workforce/:workerId`
- `PATCH /employer/workforce/:workerId/status`
- `GET /employer/payments`
- `GET /employer/payments/workers`
- `POST /employer/payments/pay`
- `GET /employer/payments/history`
- `GET /employer/payments/:paymentId`
- `GET /employer/payments/statement`
- `GET /employer/company`
- `PATCH /employer/company`
- `POST /employer/company/logo`
- `POST /employer/company/documents`
- `DELETE /employer/company/documents/:documentId`
- `GET /employer/informal-requests`
- `POST /employer/informal-requests`
- `GET /employer/notifications`
- `PATCH /employer/notifications/:notificationId/read`
- `GET /employer/settings/notifications`
- `PATCH /employer/settings/notifications`
- `PATCH /employer/settings/language`

Routes/endpoints to remove or rework from old code:

- Shift routes should not be rebuilt.
- Any `accepted` applicant status should become `hired`.
- Job `live` should become `active`.
- Job `pending` should become `under_review`.
- Employer profile must include contact person details.
- Company verification must be business-document based, not personal KYC.
