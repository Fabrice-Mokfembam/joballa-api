# Joballa Final Proposed Schema v2

This document consolidates the latest Joballa scope, platform operations notes, and data-model review into one corrected schema reference for the worker and employer product. The admin product is moving to a separate codebase, but admin-owned review fields are still included where they affect worker/employer flows.

## Design Decisions

- Worker-facing job discovery shows all listings as jobs. The UI does not need to split "formal jobs" and "informal jobs" into separate browsing experiences.
- Departments are the grouping mechanism for every job. Informal demand can enter through `informal_job_requests`, then become a normal row in `jobs`.
- AI features are future-ready only for now. Keep neutral fields such as `match_score` and `score_breakdown`, but do not implement recommendation, fraud detection, or AI profile enhancement yet.
- No shift table is included. Shift logging was intentionally removed from scope.
- Verification is role-specific:
  - Workers verify personal identity through KYC documents.
  - Employers verify the company/organisation through business documents.
- Use snake case for database columns and table names.
- All tables should include `created_at` and `updated_at` unless marked as immutable/event-only.

## Enum Reference

| Enum | Values | Notes |
| --- | --- | --- |
| `role` | `worker`, `employer` | Admin roles live in the separate admin system. |
| `preferred_language` | `eng`, `fre` | English/French. |
| `account_status` | `active`, `suspended`, `deactivated` | General account access state, not verification. |
| `verification_status` | `not_submitted`, `pending`, `under_review`, `verified`, `rejected`, `changes_requested` | Used on worker and employer verification flows. |
| `kyc_type` | `national_id`, `passport`, `drivers_license` | Worker identity documents. |
| `document_file_type` | `pdf`, `image` | Stored file type. |
| `department_category` | `education`, `domestic`, `logistics`, `events`, `agriculture`, `construction`, `software_tech`, `other` | `other` must always exist. |
| `employment_type` | `full_time`, `part_time`, `contract`, `casual`, `seasonal`, `internship` | Job schedule/contract category. |
| `work_mode` | `onsite`, `remote`, `hybrid` | How work is performed. |
| `pay_structure` | `hourly`, `daily`, `weekly`, `monthly`, `fixed` | How pay is calculated. |
| `experience_level` | `entry`, `junior`, `mid`, `senior`, `lead`, `tutor`, `not_required` | Extend only when needed. |
| `job_status` | `draft`, `under_review`, `active`, `paused`, `closed`, `rejected` | Canonical job lifecycle from the scope. |
| `informal_request_status` | `submitted`, `under_review`, `posted`, `rejected`, `changes_requested` | Request lifecycle before/while becoming a job. |
| `application_status` | `submitted`, `shortlisted`, `hired`, `rejected` | Use `hired`, not `accepted`, because hiring creates the engagement. |
| `engagement_status` | `active`, `completed`, `terminated` | No shifts table. |
| `payment_status` | `pending`, `completed`, `failed`, `refunded` | Payment lifecycle. |
| `momo_provider` | `mtn_momo`, `orange_money` | Mobile money provider. |
| `submission_target_type` | `job`, `account`, `informal_request`, `kyc_document`, `employer_document` | What was scored or reviewed. |
| `submission_tier` | `auto_approved`, `yellow_zone`, `flagged`, `auto_rejected` | Four-tier rule-based routing from operations doc. |
| `otp_purpose` | `registration`, `password_reset` | OTP use case. |
| `notification_type` | `verification_update`, `application_received`, `application_update`, `job_approved`, `job_rejected`, `payment_sent`, `payment_received`, `engagement_update`, `security_alert`, `system` | Keep broad enough for frontend rendering. |
| `notification_channel` | `in_app`, `email`, `sms` | Preference channels. |

## Shared Identity

### `users`

Stores base login/account identity for workers and employers.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `email` | `string?` | Unique when present. |
| `phone` | `string?` | Unique when present, includes country code. |
| `password_hash` | `string` | Hashed password only. |
| `photo_url` | `string?` | General avatar/profile image. |
| `country` | `string?` | Default likely Cameroon. |
| `region` | `string?` | Cameroon region. |
| `city` | `string?` | City/town. |
| `role` | `role` | `worker` or `employer`. |
| `account_status` | `account_status` | Default `active`. |
| `preferred_language` | `preferred_language` | Default `eng`. |
| `created_by_admin_id` | `uuid?` | Admin account that created the user on behalf of a caller; external admin DB reference. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

Notes:

- Do not use `is_verified` here as the source of truth. Verification belongs to `worker_profiles.verification_status` or `employer_profiles.verification_status`.
- A frontend/API response may expose a derived `is_verified` boolean for convenience.

### `otp_codes`

Stores one-time codes for registration and password reset.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `cuid` | Primary key. |
| `identifier` | `string` | Email or phone. |
| `code_hash` | `string` | Hashed OTP. |
| `purpose` | `otp_purpose` | Registration or password reset. |
| `expires_at` | `timestamp` | Expiry. |
| `used` | `boolean` | Default `false`. |
| `registration_snapshot` | `jsonb?` | Partial signup details held until OTP verification. |
| `created_at` | `timestamp` | Created timestamp. |

### `refresh_tokens`

Stores refresh tokens for JWT session management.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `cuid` | Primary key. |
| `user_id` | `uuid` | FK to `users.id`. |
| `lookup_digest` | `string` | Unique digest for lookup. |
| `token_hash` | `string` | Full hash stored server-side. |
| `expires_at` | `timestamp` | Token expiry. |
| `created_at` | `timestamp` | Created timestamp. |

### `session_logs`

Lightweight security audit for user session events.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | FK to `users.id`. |
| `ip_address` | `string?` | IP at event time. |
| `user_agent` | `string?` | Browser/device agent. |
| `action` | `string` | Example: `login`, `logout`, `token_refresh`. |
| `created_at` | `timestamp` | Event timestamp. |

## Worker Profile

### `worker_profiles`

Stores the structured professional profile used for applications.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | FK to `users.id`, unique. |
| `full_name` | `string?` | Display name. |
| `first_name` | `string?` | First name. |
| `last_name` | `string?` | Last name. |
| `date_of_birth` | `date?` | From scope profile contents. |
| `professional_title` | `string?` | Example: Web Developer, House Cleaner. |
| `short_bio` | `text?` | Professional summary. |
| `country` | `string?` | Country. |
| `region` | `string?` | Region. |
| `city` | `string?` | City. |
| `languages` | `string[]` | Languages spoken. |
| `skills` | `string[]` | Search/filter tags. |
| `preferred_job_categories` | `string[]` | Category interests. |
| `preferred_job_types` | `employment_type[]` | Preferred employment types. |
| `availability_status` | `string?` | Keep flexible for now: available, busy, unavailable, etc. |
| `years_experience_by_category` | `jsonb?` | Category to years map. |
| `cv_url` | `string?` | Uploaded CV/resume file for prefill. |
| `profile_completeness` | `integer` | 0-100 computed score. |
| `profile_completeness_breakdown` | `jsonb?` | Section-level completeness details. |
| `profile_views` | `integer` | Default `0`. |
| `verification_status` | `verification_status` | Worker identity verification status. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

Notes:

- `profile_strength` and `Profile_completeness` should be collapsed into `profile_completeness`.
- CV prefill can be implemented through API/process state without a dedicated table unless the backend needs a persistent parsing job record later.
- CV export is generated from this profile and does not require its own table for launch.

### `kyc_submissions`

Stores worker identity verification submissions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id` for the worker. |
| `kyc_type` | `kyc_type` | National ID, passport, driver license. |
| `front_url` | `string` | Front image/file. |
| `back_url` | `string?` | Required for national ID; null for passport. |
| `selfie_url` | `string` | Required for all KYC submissions. |
| `status` | `verification_status` | Review status. |
| `rejection_reason` | `text?` | User-facing reason when rejected/changes requested. |
| `verified_at` | `timestamp?` | Approved timestamp. |
| `verified_by_admin_id` | `uuid?` | External admin DB reference. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `work_experiences`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `company_name` | `string` | Employer/company name. |
| `company_website` | `string?` | Optional URL. |
| `job_title` | `string` | Role title. |
| `location` | `string?` | Location. |
| `start_date` | `date` | Start date. |
| `end_date` | `date?` | Null if current. |
| `is_current` | `boolean` | Current role flag. |
| `description` | `text?` | Responsibilities/context. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `education`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `institution_name` | `string` | School/institution. |
| `institution_website` | `string?` | Optional URL. |
| `country` | `string?` | Country. |
| `region` | `string?` | Region. |
| `city` | `string?` | City. |
| `degree` | `string?` | Degree/qualification. |
| `field_of_study` | `string?` | Field of study. |
| `start_date` | `date` | Start date. |
| `end_date` | `date?` | Null if current. |
| `is_current` | `boolean` | Current study flag. |
| `description` | `text?` | Optional details. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `certifications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `name` | `string` | Certification name. |
| `issuer` | `string?` | Issuing organisation. |
| `description` | `text?` | Optional details. |
| `credential_url` | `string?` | Verification URL. |
| `document_id` | `uuid?` | FK to `supporting_documents.id`. |
| `issue_date` | `date?` | Issue date. |
| `expiry_date` | `date?` | Expiry date. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `supporting_documents`

Worker-owned optional documents such as certificates and portfolios.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `file_url` | `string` | Stored file URL. |
| `file_name` | `string` | Display name. |
| `file_type` | `document_file_type` | PDF or image. |
| `document_label` | `string?` | Certificate, portfolio, reference, etc. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `worker_payment_accounts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `provider` | `momo_provider` | MTN MoMo or Orange Money. |
| `phone_number` | `string` | With country code. |
| `is_primary` | `boolean` | Only one primary per worker. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

## Employer Profile

### `employer_profiles`

Stores the company/organisation profile. The account has a contact person, but the verification subject is the business/organisation.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | FK to `users.id`, unique. |
| `company_name` | `string` | Company/organisation name. |
| `company_logo_url` | `string?` | Logo URL. |
| `company_size` | `string?` | Example: 1-10, 11-50. |
| `industry` | `string?` | Sector/industry. |
| `country` | `string?` | Country. |
| `region` | `string?` | Region. |
| `city` | `string?` | City. |
| `website` | `string?` | Company website. |
| `description` | `text?` | About section. |
| `tagline` | `text?` | Short promotional tagline. |
| `contact_person_name` | `string` | Primary contact person. |
| `contact_person_title` | `string?` | Optional role/title. |
| `contact_email` | `string?` | Contact email. |
| `contact_phone` | `string?` | Contact phone. |
| `payment_provider` | `momo_provider?` | Outgoing payment provider. |
| `payment_account` | `string?` | Mobile money number/account. |
| `verification_status` | `verification_status` | Business verification status. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

Notes:

- Remove duplicate/conflicting `departmentId`, `department_id`, and `department_id String?` fields from employer profile.
- Departments belong to jobs, not employer profiles, unless a separate admin system later models Joballa-managed department operators.

### `employer_documents`

Business/organisation verification documents.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `employer_id` | `uuid` | FK to `users.id` for the employer account. |
| `document_name` | `string` | Example: business registration, tax document. |
| `document_url` | `string` | Stored file URL. |
| `document_type` | `document_file_type` | PDF or image. |
| `verification_status` | `verification_status` | Review status. |
| `verification_notes` | `text?` | Internal/admin notes or user-facing changes requested message. |
| `verified_at` | `timestamp?` | Approved timestamp. |
| `verified_by_admin_id` | `uuid?` | External admin DB reference. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

## Departments

### `departments`

Every job belongs to exactly one department. `other` always exists and cannot be deleted.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `name` | `string` | Example: Education, Domestic, Software & Tech. |
| `slug` | `string` | Unique URL-safe slug. |
| `description` | `text?` | Shown to users when browsing. |
| `category` | `department_category` | Canonical category. |
| `is_active` | `boolean` | Inactive departments hidden from new listings but preserved for existing jobs. |
| `created_by_admin_id` | `uuid?` | External admin DB reference; default super admin/system. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

## Jobs And Requests

### `informal_job_requests`

Captures "Need Someone?" or department-routed job requests before they become normal jobs. Both workers and employers may submit these.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `requester_id` | `uuid` | FK to `users.id`, worker or employer. |
| `department_id` | `uuid` | FK to `departments.id`. |
| `department_category` | `department_category` | Denormalized for easier validation/routing. |
| `form_data` | `jsonb` | Department-specific responses. |
| `payment_managed_by_joballa` | `boolean` | If true, payment flows through Fapshi/platform. |
| `status` | `informal_request_status` | Request lifecycle. |
| `assigned_job_id` | `uuid?` | FK to `jobs.id` after request is posted as a job. |
| `created_by_admin` | `boolean` | True for phone-in/admin-created requests. |
| `created_by_admin_id` | `uuid?` | External admin DB reference. |
| `admin_notes` | `text?` | Internal review notes. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

Suggested `form_data` shape by department:

- Education: `subject`, `student_age_or_level`, `preferred_schedule`, `location`, `budget_range`
- Domestic: `help_type`, `frequency`, `location`, `start_date`, `budget_range`
- Logistics: `task_type`, `pickup_location`, `dropoff_location`, `date_time`, `item_description`, `budget`
- Events: `event_type`, `event_date`, `location`, `workers_needed`, `roles`, `budget`
- Agriculture: `work_type`, `location_or_area`, `duration`, `workers_needed`, `budget`
- Construction: `work_type`, `location`, `duration`, `tools_provided`, `budget`
- Other: `title`, `description`, `location`, `pay`, `duration`, `requirements`

### `jobs`

Canonical job listing table. Worker-facing UI can show all active rows as jobs.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `owner_id` | `uuid` | FK to `users.id`; employer or requester account. |
| `informal_request_id` | `uuid?` | FK to `informal_job_requests.id` when created from a request. |
| `department_id` | `uuid` | FK to `departments.id`; defaults to `other`. |
| `title` | `string` | Job title. |
| `employment_type` | `employment_type` | Full-time, part-time, contract, etc. |
| `work_mode` | `work_mode` | Onsite, remote, hybrid. |
| `country` | `string` | Country. |
| `region` | `string?` | Region. |
| `city` | `string` | City. |
| `neighbourhood` | `string?` | Example: Akwa. |
| `pay_amount` | `integer` | Base currency units. |
| `pay_currency` | `string` | Default `XAF`. |
| `pay_structure` | `pay_structure` | Hourly, daily, monthly, fixed, etc. |
| `experience_level` | `experience_level` | Optional skill/seniority signal. |
| `start_date` | `date?` | Null when `start_now` is true. |
| `start_now` | `boolean` | Start immediately. |
| `duration` | `string?` | Example: 9 months, 2 weeks. |
| `description` | `text` | About this role. |
| `requirements` | `text[]` | Requirements bullets. |
| `responsibilities` | `text[]` | What worker will do. |
| `required_skills` | `string[]` | Skill tags. |
| `requested_documents` | `jsonb?` | Documents employer/requester asks applicants to attach. |
| `number_of_openings` | `integer` | Default `1`. |
| `status` | `job_status` | Draft/review/active/etc. |
| `payment_managed_by_joballa` | `boolean` | Visible trust/payment signal where relevant. |
| `admin_notes` | `text?` | Internal notes. |
| `approved_by_admin_id` | `uuid?` | External admin DB reference. |
| `approved_at` | `timestamp?` | Approval timestamp. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

Suggested `requested_documents` shape:

```json
[
  {
    "key": "teaching_certificate",
    "label": "Teaching certificate",
    "required": false,
    "acceptedFileTypes": ["pdf", "image"]
  }
]
```

## Applications

### `applications`

Stores worker applications and the profile snapshot captured at submission time.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `job_id` | `uuid` | FK to `jobs.id`. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `status` | `application_status` | Submitted, shortlisted, hired, rejected. |
| `cover_note` | `text?` | Job-specific note from worker. |
| `employer_notes` | `text?` | Employer note, especially on rejection. |
| `profile_snapshot` | `jsonb` | Worker profile captured at application time. |
| `attached_documents` | `jsonb?` | Worker-submitted documents for this application. |
| `match_score` | `integer?` | Future-ready 0-100 match indicator; can remain null/manual for now. |
| `interview_time` | `timestamp?` | Scheduled interview time, if used. |
| `submitted_at` | `timestamp` | Submission timestamp. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

Suggested `attached_documents` shape:

```json
[
  {
    "requestedDocumentKey": "teaching_certificate",
    "supportingDocumentId": "uuid",
    "fileUrl": "https://...",
    "fileName": "certificate.pdf"
  }
]
```

### `saved_jobs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `job_id` | `uuid` | FK to `jobs.id`. |
| `created_at` | `timestamp` | Saved timestamp. |

### `hidden_jobs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `job_id` | `uuid` | FK to `jobs.id`. |
| `created_at` | `timestamp` | Hidden timestamp. |

### `job_reports`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `job_id` | `uuid` | FK to `jobs.id`. |
| `reason` | `text` | Report reason/context. |
| `created_at` | `timestamp` | Report timestamp. |

## Scoring And Review

### `submission_scores`

Stores output from the rule-based validation/scoring system. This is not AI.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `target_type` | `submission_target_type` | Scored entity type. |
| `target_id` | `uuid` | Polymorphic target ID. |
| `score` | `integer` | 0-100 overall score. |
| `tier` | `submission_tier` | Auto-approved, yellow-zone, flagged, auto-rejected. |
| `score_breakdown` | `jsonb?` | Per-criterion weights and values. |
| `reviewed_by_admin_id` | `uuid?` | External admin DB reference. |
| `reviewed_at` | `timestamp?` | Human review timestamp. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `rejection_reasons`

Stores mandatory reasons for rejected submissions.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `target_type` | `submission_target_type` | Rejected entity type. |
| `target_id` | `uuid` | Polymorphic target ID. |
| `reason_text` | `text` | User-facing and audit-friendly explanation. |
| `rejected_by_admin_id` | `uuid?` | Null for auto-rejections. |
| `created_at` | `timestamp` | Created timestamp. |

### `change_requests`

Stores non-rejection requests for fixes/resubmission.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `target_type` | `submission_target_type` | Entity needing changes. |
| `target_id` | `uuid` | Polymorphic target ID. |
| `message` | `text` | User-facing requested changes. |
| `requested_by_admin_id` | `uuid?` | External admin DB reference. |
| `resolved_at` | `timestamp?` | Set when user resubmits/fixes. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

## Workforce And Payments

### `work_engagements`

Created when an employer/requester hires a worker.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `job_id` | `uuid` | FK to `jobs.id`. |
| `application_id` | `uuid` | FK to `applications.id`. |
| `worker_id` | `uuid` | FK to `users.id`. |
| `employer_id` | `uuid` | FK to `users.id`; the hiring/requesting account. |
| `start_date` | `date` | Date worker joined/was hired. |
| `end_date` | `date?` | End/completion date. |
| `role_label` | `string?` | Custom role label if different from job title. |
| `employment_type` | `employment_type` | Full-time, part-time, contract, etc. |
| `pay_rate` | `integer` | Agreed rate at hiring. |
| `pay_currency` | `string` | Default `XAF`. |
| `pay_structure` | `pay_structure` | Hourly/daily/monthly/fixed/etc. |
| `status` | `engagement_status` | Active, completed, terminated. |
| `task_notes` | `text?` | Optional engagement notes. |
| `termination_reason` | `text?` | Required if terminated. |
| `started_at` | `timestamp` | Started timestamp. |
| `completed_at` | `timestamp?` | Completion timestamp. |
| `terminated_at` | `timestamp?` | Termination timestamp. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `payments`

Mobile money payment transactions between payer and worker, processed via Fapshi when managed by Joballa.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `engagement_id` | `uuid` | FK to `work_engagements.id`. |
| `worker_id` | `uuid` | FK to `users.id`, recipient. |
| `payer_id` | `uuid` | FK to `users.id`, payer/employer/requester. |
| `amount` | `decimal(12,2)` | Payment amount. |
| `currency` | `string` | Default `XAF`. |
| `mobile_money_provider` | `momo_provider` | MTN MoMo or Orange Money. |
| `recipient_number` | `string` | Worker mobile money number. |
| `payment_platform` | `string?` | Example: Fapshi. |
| `payment_method` | `string?` | Example: MTN Mobile Money. |
| `receipt_number` | `string?` | Provider receipt number. |
| `fapshi_transaction_id` | `string?` | Unique Fapshi transaction ID. |
| `fapshi_reference` | `string?` | Fapshi reference code. |
| `idempotency_key` | `string` | Unique key to prevent duplicate disbursement. |
| `status` | `payment_status` | Pending, completed, failed, refunded. |
| `failure_reason` | `string?` | Failure reason. |
| `pay_period` | `string?` | Human-readable period. |
| `archived_at` | `timestamp?` | Soft archive. |
| `initiated_at` | `timestamp` | Initiation timestamp. |
| `confirmed_at` | `timestamp?` | Provider/webhook confirmation. |
| `completed_at` | `timestamp?` | Final completion timestamp. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

## Notifications

### `notifications`

In-app notification history and unread badge source.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | FK to `users.id`. |
| `type` | `notification_type` | Notification category. |
| `title` | `string` | Short headline. |
| `body` | `string` | Full message. |
| `is_read` | `boolean` | Drives unread badge. |
| `related_type` | `string?` | job, application, payment, engagement, etc. |
| `related_id` | `uuid?` | Related entity ID. |
| `created_at` | `timestamp` | Notification timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

### `notification_settings`

Per-user notification preferences.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `user_id` | `uuid` | FK to `users.id`, unique. |
| `in_app_enabled` | `boolean` | Default `true`. |
| `email_enabled` | `boolean` | Default `true`. |
| `sms_enabled` | `boolean` | Default `true` for critical messages/OTP where applicable. |
| `application_updates` | `boolean` | Application status and applicant updates. |
| `job_updates` | `boolean` | Job approval/rejection/live updates. |
| `payment_updates` | `boolean` | Payment sent/received/failure. |
| `engagement_updates` | `boolean` | Hire/termination/completion updates. |
| `security_alerts` | `boolean` | Critical security events; should generally stay on. |
| `marketing_updates` | `boolean` | Optional product/marketing messages. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

## Disputes

### `disputes`

Formal disputes between users. Admin handling lives in the separate admin codebase, but worker/employer portals may create and view their own disputes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `raised_by_user_id` | `uuid` | FK to `users.id`. |
| `against_user_id` | `uuid` | FK to `users.id`. |
| `engagement_id` | `uuid?` | FK to `work_engagements.id`. |
| `subject` | `string` | Short subject. |
| `description` | `text` | Full description. |
| `status` | `string` | Open/resolved/etc.; can be enumed in admin schema. |
| `admin_notes` | `text?` | Internal notes. |
| `resolved_by_admin_id` | `uuid?` | External admin DB reference. |
| `resolution` | `text?` | Resolution summary. |
| `resolved_at` | `timestamp?` | Resolution timestamp. |
| `created_at` | `timestamp` | Created timestamp. |
| `updated_at` | `timestamp` | Updated timestamp. |

## Platform Settings

### `platform_settings`

Key-value settings that may influence frontend behavior.

| Column | Type | Notes |
| --- | --- | --- |
| `key` | `string` | Primary key. |
| `value` | `jsonb` | Any JSON setting value. |
| `updated_at` | `timestamp` | Updated timestamp. |

Potential settings:

- Department pay reference ranges
- Job scoring thresholds
- Supported locations
- Feature flags for CV prefill/export
- Feature flags for future AI/recommendation blocks

## Frontend-Relevant API Expectations

The backend should expose worker/employer APIs that hide unnecessary admin storage details but preserve the following fields:

- Jobs:
  - `status`
  - `department`
  - `paymentManagedByJoballa`
  - `requestedDocuments`
  - `reviewTier` or `submissionScore` when useful to owners
  - `rejectionReason` or `changeRequest` when applicable
- Applications:
  - `profileSnapshot`
  - `attachedDocuments`
  - `status`
  - `matchScore` nullable/future-ready
- Worker:
  - `verificationStatus`
  - `profileCompleteness`
  - `profileCompletenessBreakdown`
- Employer:
  - `verificationStatus`
  - contact fields
  - business documents
- Informal requests:
  - request creation
  - status tracking
  - assigned job link after posting
- Notifications:
  - unread count
  - mark as read
  - settings update

## Corrections From Data Model PDF

- Add missing `informal_job_requests`.
- Add `requested_documents` to `jobs`.
- Add `attached_documents` to `applications`.
- Do not add `shift_logs`; shift tracking was intentionally removed.
- Use document/scope enum names consistently:
  - `job_status`: `draft`, `under_review`, `active`, `paused`, `closed`, `rejected`
  - `application_status`: `submitted`, `shortlisted`, `hired`, `rejected`
  - `engagement_status`: `active`, `completed`, `terminated`
  - `submission_tier`: `auto_approved`, `yellow_zone`, `flagged`, `auto_rejected`
- Add employer contact details:
  - `contact_person_name`
  - `contact_person_title`
  - `contact_email`
  - `contact_phone`
- Replace inconsistent naming such as `fullName`, `Skills`, `City`, `Profile_completeness` with snake case.
- Treat verification as role-specific:
  - `worker_profiles.verification_status`
  - `employer_profiles.verification_status`
  - `kyc_submissions.status`
  - `employer_documents.verification_status`
- Add `notification_settings`.
- Add `change_requests` so review can request fixes without rejecting outright.
