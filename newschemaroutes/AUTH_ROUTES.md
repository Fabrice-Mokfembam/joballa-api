# AUTH ROUTES

This document defines the authentication routes and API contracts for rebuilding Joballa against the new database while keeping the current simple UI direction.

Admin is out of this frontend codebase. Auth here covers only Worker and Employer users.

## Auth Principles

- Keep signup simple.
- Signup must start from role selection, then use either phone or email plus password.
- Do not add the full worker profile fields or employer company fields into signup.
- Worker profile and employer company profile are completed after account creation inside the portal.
- Users may sign in with phone or email plus password.
- OTP verification remains part of registration.
- Store auth tokens client-side as currently planned, with refresh support.
- Role-based redirects:
  - Worker goes to `/worker/jobs`.
  - Employer goes to `/employer`.
- Guest-only routes should redirect signed-in users to their role portal.
- Protected portal routes should redirect unauthenticated users to `/sign-in?callbackUrl=...`.

## Auth Data Shapes

### User Session

Expected user returned by auth endpoints:

```ts
type AuthSessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "worker" | "employer";
  preferredLanguage: "eng" | "fre";
  accountStatus: "active" | "suspended" | "deactivated";
  profilePhotoUrl?: string | null;
  workerProfileId?: string | null;
  employerProfileId?: string | null;
};
```

### Token Response

```ts
type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthSessionUser;
};
```

### API Error Shape

Every auth endpoint should return a stable error shape:

```ts
type ApiError = {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
};
```

## Frontend Routes

### `/`

Landing page.

What it does:

- Shows public Joballa marketing hero.
- Links users to sign up, sign in, worker/employer CTAs.
- Includes language switcher.

Sends:

- Nothing.

Receives:

- Static translated copy.
- Optional public configuration later, such as enabled locales or feature flags.

Notes:

- Current UI can stay simple.
- The richer scope sections can be added later, but auth must work first.

### `/login`

Legacy route.

What it does:

- Redirects to `/sign-in`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/signup`

Legacy route.

What it does:

- Redirects to `/sign-up/role`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/sign-up/role`

Role selection page.

What it does:

- Lets user choose Worker or Employer.
- Stores pending signup role locally until registration.
- Sends user to `/sign-up/phone` by default, with option to switch to email.

Sends:

- Nothing to backend yet.

Receives:

- Nothing from backend.

Local state:

```ts
type PendingSignupIntent = {
  role: "worker" | "employer";
};
```

Notes:

- Do not ask employer company details here.
- Do not ask worker profile details here.

### `/sign-up/phone`

Phone signup page.

What it does:

- Registers a Worker or Employer using phone and password.
- Uses the role selected on `/sign-up/role`.
- Starts OTP flow.

Sends to API:

`POST /auth/register`

```ts
type RegisterWithPhoneRequest = {
  role: "worker" | "employer";
  phone: string;
  password: string;
  preferredLanguage: "eng" | "fre";
};
```

Receives:

```ts
type RegisterResponse = {
  identifier: string;
  deliveryChannel: "sms";
  otpExpiresAt: string;
  message: string;
};
```

Then route to:

- `/sign-up/verify/phone`

Validation:

- Phone required.
- Cameroonian phone format preferred.
- Password required.
- Role required from local state.

### `/sign-up/email`

Email signup page.

What it does:

- Registers a Worker or Employer using email and password.
- Uses the role selected on `/sign-up/role`.
- Starts OTP/email verification flow.

Sends to API:

`POST /auth/register`

```ts
type RegisterWithEmailRequest = {
  role: "worker" | "employer";
  email: string;
  password: string;
  preferredLanguage: "eng" | "fre";
};
```

Receives:

```ts
type RegisterResponse = {
  identifier: string;
  deliveryChannel: "email";
  otpExpiresAt: string;
  message: string;
};
```

Then route to:

- `/sign-up/verify/email`

Validation:

- Email required.
- Password required.
- Role required from local state.

### `/sign-up/verify`

Generic verification route.

What it does:

- Redirects to the correct verification page based on pending signup identifier.
- If the pending signup was phone, go to `/sign-up/verify/phone`.
- If email, go to `/sign-up/verify/email`.
- If no pending signup, go to `/sign-up/role`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/sign-up/verify/phone`

Phone OTP verification page.

What it does:

- User enters OTP sent by SMS.
- Verifies account.
- Establishes session.
- Redirects to role portal.

Sends to API:

`POST /auth/verify`

```ts
type VerifyPhoneRequest = {
  identifier: string;
  code: string;
  purpose: "registration";
};
```

Receives:

```ts
type VerifyResponse = AuthTokensResponse;
```

Redirect:

- Worker: `/worker/jobs`
- Employer: `/employer`

### `/sign-up/verify/email`

Email OTP verification page.

What it does:

- User enters OTP sent by email.
- Verifies account.
- Establishes session.
- Redirects to role portal.

Sends to API:

`POST /auth/verify`

```ts
type VerifyEmailRequest = {
  identifier: string;
  code: string;
  purpose: "registration";
};
```

Receives:

```ts
type VerifyResponse = AuthTokensResponse;
```

Redirect:

- Worker: `/worker/jobs`
- Employer: `/employer`

### `/sign-up/interests`

Current UI route kept as optional onboarding.

What it does:

- May collect worker job interests after signup.
- This is not required for account creation.

Sends to API:

Optional later:

`PATCH /worker/profile/preferences`

```ts
type WorkerInterestsRequest = {
  preferredJobCategories: string[];
  preferredJobTypes?: string[];
};
```

Receives:

```ts
type WorkerProfileResponse = {
  id: string;
  preferredJobCategories: string[];
  preferredJobTypes: string[];
  profileCompleteness: number;
};
```

Notes:

- If rebuilding from scratch, this page can be skipped or redirected to `/worker/profile/edit` until onboarding is ready.

### `/sign-up/post-categories`

Current UI route kept as optional employer onboarding.

What it does:

- May collect employer preferred posting categories after signup.
- This is not required for account creation.

Sends to API:

Optional later:

`PATCH /employer/company/preferences`

```ts
type EmployerCategoryPreferencesRequest = {
  preferredDepartments: string[];
};
```

Receives:

```ts
type EmployerCompanyResponse = {
  id: string;
  preferredDepartments?: string[];
};
```

Notes:

- If not implemented, redirect employers to `/employer/profile/edit`.

### `/sign-up/profile`

Current UI route kept as redirect/onboarding helper.

What it does:

- Sends worker to `/worker/profile/edit`.
- Sends employer to `/employer/profile/edit`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/sign-in`

Default sign-in page. Current UI uses phone-first sign-in.

What it does:

- Lets user sign in with phone and password.
- Offers switch to email sign-in.
- Honors `callbackUrl`.

Sends to API:

`POST /auth/login`

```ts
type LoginRequest = {
  identifier: string;
  password: string;
};
```

Receives:

```ts
type LoginResponse = AuthTokensResponse;
```

Redirect:

- If `callbackUrl` is safe and role can access it, go there.
- Else Worker: `/worker/jobs`
- Else Employer: `/employer`

### `/sign-in/email`

Email sign-in page.

What it does:

- Lets user sign in with email and password.
- Offers switch back to phone sign-in.
- Honors `callbackUrl`.

Sends to API:

`POST /auth/login`

```ts
type LoginRequest = {
  identifier: string;
  password: string;
};
```

Receives:

```ts
type LoginResponse = AuthTokensResponse;
```

### `/sign-in/phone`

Legacy/helper route.

What it does:

- Redirects to `/sign-in`, preserving query params.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/forgot-password`

Password reset request page.

What it does:

- Lets user enter email or phone.
- Sends OTP/reset code.

Sends to API:

`POST /auth/forgot-password`

```ts
type ForgotPasswordRequest = {
  identifier: string;
};
```

Receives:

```ts
type AuthMessageResponse = {
  message: string;
  identifier?: string;
  deliveryChannel?: "email" | "sms";
  otpExpiresAt?: string;
};
```

Then route to:

- `/reset-password`

### `/reset-password`

Password reset completion page.

What it does:

- User enters identifier, OTP/code, and new password.
- Resets password.
- Redirects to sign-in with a success hint.

Sends to API:

`POST /auth/reset-password`

```ts
type ResetPasswordRequest = {
  identifier: string;
  code: string;
  newPassword: string;
};
```

Receives:

```ts
type AuthMessageResponse = {
  message: string;
};
```

Redirect:

- `/sign-in?reset=1`

## Auth API Endpoints

### `POST /auth/register`

Creates a pending Worker or Employer account and sends OTP.

Sends:

```ts
type RegisterRequest = {
  role: "worker" | "employer";
  email?: string;
  phone?: string;
  password: string;
  preferredLanguage: "eng" | "fre";
};
```

Rules:

- Exactly one of `email` or `phone` is required.
- `role` is required.
- Do not require worker profile fields.
- Do not require company profile fields.

Receives:

```ts
type RegisterResponse = {
  identifier: string;
  deliveryChannel: "email" | "sms";
  otpExpiresAt: string;
  message: string;
};
```

Side effects:

- Create pending registration/OTP record.
- Account may be created immediately as unverified, or stored in `registration_snapshot` until OTP verification. Backend chooses, but frontend response stays the same.

### `POST /auth/verify`

Verifies OTP and returns a session.

Sends:

```ts
type VerifyRequest = {
  identifier: string;
  code: string;
  purpose: "registration";
};
```

Receives:

```ts
type VerifyResponse = AuthTokensResponse;
```

Side effects:

- Marks OTP as used.
- Creates user/profile shell if not already created.
- Worker role should create empty `worker_profiles` row.
- Employer role should create empty `employer_profiles` row with contact fields to be completed later.

### `POST /auth/resend-otp`

Resends OTP.

Sends:

```ts
type ResendOtpRequest = {
  identifier: string;
  purpose: "registration" | "password_reset";
};
```

Receives:

```ts
type AuthMessageResponse = {
  message: string;
  otpExpiresAt?: string;
};
```

### `POST /auth/login`

Signs in with email or phone and password.

Sends:

```ts
type LoginRequest = {
  identifier: string;
  password: string;
};
```

Receives:

```ts
type LoginResponse = AuthTokensResponse;
```

Error cases:

- `401`: invalid credentials (Google-only accounts: message directs user to Continue with Google).
- `403`: account suspended/deactivated or not verified enough for login, depending backend policy.
- `409`: account exists but registration OTP not completed.

### `POST /auth/google`

Google Sign-In / Sign-up (worker & employer only). Full frontend guide: [FRONTEND_GOOGLE_SIGNIN.md](./FRONTEND_GOOGLE_SIGNIN.md).

Sends:

```ts
type GoogleAuthRequest = {
  idToken: string;
  mode: "signup" | "signin";
  role?: "worker" | "employer";       // required when mode === "signup"
  preferredLanguage?: "eng" | "fre";
};
```

Receives:

```ts
type GoogleAuthResponse = AuthTokensResponse & { isNewUser: boolean };
```

Error cases:

- `400`: invalid token, missing role on signup, Google not configured.
- `403`: account suspended (`ACCOUNT_SUSPENDED`).
- `404`: sign-in — no account for this Google user.
- `409`: email already registered with password; role mismatch.

### `GET /auth/me`

Returns current session user.

Sends:

- Bearer access token.

Receives:

```ts
type AuthMeResponse = {
  user: AuthSessionUser;
};
```

### `POST /auth/refresh`

Refreshes access token.

Sends:

```ts
type RefreshRequest = {
  refreshToken: string;
};
```

Receives:

```ts
type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
  user?: AuthSessionUser;
};
```

### `POST /auth/logout`

Ends current session.

Sends:

```ts
type LogoutRequest = {
  refreshToken?: string;
};
```

Receives:

```ts
type AuthMessageResponse = {
  message: string;
};
```

### `POST /auth/forgot-password`

Starts password reset.

Sends:

```ts
type ForgotPasswordRequest = {
  identifier: string;
};
```

Receives:

```ts
type AuthMessageResponse = {
  message: string;
  deliveryChannel?: "email" | "sms";
  otpExpiresAt?: string;
};
```

### `POST /auth/reset-password`

Completes password reset.

Sends:

```ts
type ResetPasswordRequest = {
  identifier: string;
  code: string;
  newPassword: string;
};
```

Receives:

```ts
type AuthMessageResponse = {
  message: string;
};
```

## Route Protection

Protected portal prefixes:

- `/worker`
- `/employer`

Guest-only prefixes:

- `/sign-in`
- `/login`
- `/forgot-password`
- `/reset-password`

Access rules:

- Worker can access `/worker/**` only.
- Employer can access `/employer/**` only.
- Signed-in Worker visiting employer portal redirects to `/worker/jobs`.
- Signed-in Employer visiting worker portal redirects to `/employer`.
- Signed-in users visiting guest-only auth pages redirect to their portal.

## Current UI Notes For Rebuild

- Keep the existing auth split-layout look.
- Keep phone and email sign-in separate because the UI already supports it.
- Keep role picker simple.
- Google sign-in is visible in current UI but not connected. Either hide it or keep disabled until backend supports it.
- Do not block account creation on employer company details.
- Do not block account creation on worker profile details.
- Verification documents are portal tasks after login.
