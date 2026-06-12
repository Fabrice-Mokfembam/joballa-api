# FRONTEND EMPLOYER ROUTES

This document is for the frontend team. It describes Employer portal pages, what each page does, which backend endpoint it calls, what it sends, and what it receives.

**Verified against the running API** — see `VERIFIED_API_INTEGRATION.md`. Employer routes use `/employer/*` (not `/api/employer/*`). Lists use `{ data, page, limit, total, totalPages }`.

All Employer API calls require a Bearer access token and the authenticated user must have role `employer`.

Admin routes are pending and will be documented later. Employer pages may still display review status, rejection reasons, and change requests when those values exist.

## Shared Employer Types

```ts
type Paginated<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type EmployerJobCard = {
  id: string;
  title: string;
  departmentId: string;
  department: {
    id: string;
    name: string;
    slug: string;
    category: string;
  } | null;
  city: string;
  region?: string | null;
  country: string;
  neighbourhood?: string | null;
  employmentType: "full_time" | "part_time" | "contract" | "casual" | "seasonal" | "internship";
  workMode: "onsite" | "remote" | "hybrid";
  experienceLevel?: string | null;
  payAmount: number;
  payCurrency: "XAF";
  payStructure: "hourly" | "daily" | "weekly" | "monthly" | "fixed";
  status: "draft" | "under_review" | "active" | "paused" | "closed" | "rejected";
  paymentManagedByJoballa: boolean;
  applicantsCount: number;
  shortlistedCount: number;
  hiredCount: number;
  submissionTier?: string | null;
  rejectionReason?: string | null;
  changeRequest?: string | null;
  createdAt: string;
  approvedAt?: string | null;
};
```

## Pages And API Contracts

### Session bootstrap — `GET /employer/me`

Call after login for employer portal shell / guards.

Sends: Bearer token only.

Receives:

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
    verificationStatus: string;
  };
};
```

### `/employer`

What it does:

- Employer dashboard.
- Shows stats, active jobs, recent applicants, and next actions.

API:

- `GET /employer/dashboard`

Sends:

- Nothing beyond auth token.

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
  nextActions: Array<{ key: string; label: string; href: string }>;
};
```

### `/employer/jobs/new` — departments

What it does:

- Loads category → `departmentId` mapping for post/edit job forms.

API:

- `GET /employer/departments`

Sends:

```ts
type EmployerDepartmentsQuery = {
  isActive?: boolean; // default true
  category?: string;  // e.g. "education", "software_tech"
};
```

Receives:

```ts
type EmployerDepartment = {
  id: string;
  name: string;
  slug: string;
  category:
    | "education"
    | "domestic"
    | "logistics"
    | "events"
    | "agriculture"
    | "construction"
    | "software_tech"
    | "other";
  isActive: boolean;
};

type EmployerDepartmentsResponse = {
  data: EmployerDepartment[];
  total: number;
  page: number;
  limit: number;
};
```

Seed on backend: `npm run seed:departments`. See [BACKEND_RESPONSE_EMPLOYER_DEPARTMENTS.md](./BACKEND_RESPONSE_EMPLOYER_DEPARTMENTS.md).

### `/employer/jobs`

What it does:

- Lists employer-owned jobs.
- Supports status and search filters.

API:

- `GET /employer/jobs`

Sends:

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

What it does:

- Creates a standard employer job.
- Can save as draft or submit.

**Full field reference:** [EMPLOYER_JOB_POSTING_GUIDE.md](./EMPLOYER_JOB_POSTING_GUIDE.md)

API:

- `POST /employer/jobs`

Sends:

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
  requestedDocuments?: unknown[];
  numberOfOpenings: number;
  paymentManagedByJoballa?: boolean;
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
  message: string; // e.g. "Job submitted. Joballa admin will review before going live."
};
```

**Moderation:** `asDraft: false` → `under_review` (not `active`). See [BACKEND_RESPONSE_EMPLOYER_JOB_MODERATION.md](./BACKEND_RESPONSE_EMPLOYER_JOB_MODERATION.md).

### `/employer/jobs/[jobId]`

What it does:

- Shows employer job detail.
- Allows update, status change, draft save, and delete.

APIs:

- `GET /employer/jobs/:jobId`
- `PATCH /employer/jobs/:jobId`
- `PATCH /employer/jobs/:jobId/status`
- `POST /employer/jobs/:jobId/draft`
- `DELETE /employer/jobs/:jobId`

Sends:

```ts
type UpdateEmployerJobRequest = Partial<CreateEmployerJobRequest>;

type UpdateEmployerJobStatusRequest = {
  status: "draft" | "under_review" | "active" | "paused" | "closed";
};
```

Receives:

```ts
type EmployerJobDetail = EmployerJobCard & {
  departmentId: string;
  neighbourhood?: string | null;
  experienceLevel?: string | null;
  duration?: string | null;
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

type DeleteResponse = {
  ok: true;
};
```

### `/employer/applicants`

What it does:

- Lists applicants for employer jobs.
- Supports search, job filter, status filter, and sorting.

APIs:

- `GET /employer/applicants`
- `GET /employer/applicants/filters`

Sends:

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
  /** Application UUID — use for `/employer/applicants/:applicationId` routes (same value as `applicationId`) */
  id: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  workerId: string;
  /** Display name for cards — from profileSnapshot.fullName, never login email */
  workerName: string;
  /** Professional subtitle, e.g. "Frontend Developer, Marketer" */
  workerHeadline?: string | null;
  workerPhotoUrl?: string | null;
  workerLocation?: string | null;
  topSkills: string[];
  verificationStatus: string;
  availabilityStatus?: string | null;
  status: "submitted" | "shortlisted" | "hired" | "rejected";
  matchScore?: number | null;
  submittedAt: string;
  /** Login email — optional; do not use as card title */
  workerEmail?: string | null;
};

type EmployerApplicantsResponse = Paginated<EmployerApplicantListItem>;

type EmployerApplicantFilters = {
  jobs: Array<{ id: string; title: string }>;
  statuses: string[];
};
```

### `/employer/applicants/[applicationId]`

What it does:

- Shows applicant detail using application profile snapshot.
- Allows shortlist, reject, hire, note update, and share.
- Hiring creates a work engagement if one does not already exist.

APIs:

- `GET /employer/applicants/:applicationId`
- `PATCH /employer/applicants/:applicationId/status`
- `PATCH /employer/applicants/:applicationId/notes`
- `GET /employer/applicants/:applicationId/share`

Sends:

```ts
type UpdateApplicantStatusRequest = {
  status: "shortlisted" | "hired" | "rejected";
  note?: string;
};

type UpdateApplicantNotesRequest = {
  employerNotes: string;
};
```

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
  workHistory?: Array<{
    company?: string;
    companyName?: string;
    role?: string;
    jobTitle?: string;
    description?: string | null;
    period?: string;
    startDate?: string | null;
    endDate?: string | null;
    location?: string | null;
  }>;
  workHistories?: ApplicantProfileSnapshot["workHistory"];
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
  documents?: Array<{
    name: string;
    fileName?: string;
    type?: string;
    size?: string | number | null;
    url?: string;
  }>;
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
  }>;
  profileSnapshot: ApplicantProfileSnapshot;
  job: EmployerJobDetail;
};

type UpdateApplicantNotesResponse = {
  applicationId: string;
  employerNotes: string | null;
};

type ApplicantShareResponse = {
  url: string;
};
```

### `/employer/workforce`

What it does:

- Lists hired workers/engagements.
- No shift log routes or UI.

API:

- `GET /employer/workforce`

Sends:

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

What it does:

- Shows engagement detail for a hired worker.
- Allows complete or terminate engagement.

APIs:

- `GET /employer/workforce/:workerId`
- `PATCH /employer/workforce/:workerId/status`

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
type EmployerWorkforceWorkerDetail = EmployerWorkforceListItem & {
  profileSnapshot?: unknown;
  publicProfile?: unknown;
  taskNotes?: string | null;
  terminationReason?: string | null;
  payments: EmployerPaymentHistoryItem[];
};
```

### `/employer/payroll`

What it does:

- Shows payment summary, payable workers, and payment history.
- Allows payment initiation.

APIs:

- `GET /employer/payments`
- `GET /employer/payments/workers`
- `POST /employer/payments/pay`
- `GET /employer/payments/history`
- `GET /employer/payments/statement`

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
type EmployerPaymentsSummary = {
  totalPayroll: number;
  pending: number;
  paidThisMonth: number;
  outstanding: number;
  currency: "XAF";
};

type EmployerPayWorkerItem = {
  engagementId: string;
  workerId: string;
  workerName: string;
  jobTitle: string;
  amountDue: number;
  currency: "XAF";
  provider: "mtn_momo" | "orange_money" | null;
  recipientNumber: string;
  paymentManagedByJoballa: boolean;
  alreadyPaid: boolean;
};

type PayWorkerResponse = {
  paymentId: string;
  status: "pending" | "completed" | "failed";
  message: string;
};
```

### `/employer/payroll/[paymentId]`

What it does:

- Shows one payment detail.

API:

- `GET /employer/payments/:paymentId`

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

type EmployerPaymentDetail = EmployerPaymentHistoryItem & {
  receiptNumber?: string | null;
  fapshiTransactionId?: string | null;
  failureReason?: string | null;
};
```

### `/employer/profile`

What it does:

- Shows employer company profile preview.

API:

- `GET /employer/company`

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

What it does:

- Edits company identity, contact details, logo, business documents, and payment settings.

APIs:

- `PATCH /employer/company`
- `POST /employer/company/logo`
- `POST /employer/company/documents`
- `DELETE /employer/company/documents/:documentId`

Sends:

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

Upload sends:

- Logo: `multipart/form-data`, field name `file`
- Business document: `multipart/form-data`, field name `file`, optional `documentName`

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

Company update and logo upload receive `EmployerCompany`.

### `/employer/requests/new`

What it does:

- Creates a department-routed informal request.
- Different from standard job posting.

API:

- `POST /employer/informal-requests`

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
type CreateInformalJobResponse = {
  id: string;
  status: "submitted" | "under_review" | "posted" | "rejected";
  assignedJobId?: string | null;
  message: string;
};
```

### `/employer/requests`

What it does:

- Lists employer informal requests.

API:

- `GET /employer/informal-requests`

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

type EmployerInformalRequestsResponse = Paginated<InformalJobRequestListItem>;
```

### `/employer/notifications`

What it does:

- Shows notifications and marks them read.

APIs:

- `GET /employer/notifications`
- `PATCH /employer/notifications/:notificationId/read`

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

### `/employer/settings`

What it does:

- Manages notification preferences and language.

APIs:

- `GET /employer/settings/notifications`
- `PATCH /employer/settings/notifications`
- `PATCH /employer/settings/language`

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
