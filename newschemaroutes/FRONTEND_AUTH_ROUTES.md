# FRONTEND AUTH ROUTES

This document is for the frontend team. It describes the auth pages, what each page does, which backend endpoint it calls, what it sends, and what it receives.

**Verified against the running API** — see `VERIFIED_API_INTEGRATION.md` for base URL, smoke-test status, and breaking changes vs legacy `/api/*` routes.

Admin routes are pending and will be documented later when the admin developer finishes that contract. This auth document currently covers Worker and Employer users.

## API base

- Local: `http://127.0.0.1:8000`
- Auth paths: `/auth/*` (no `/api` prefix)
- Register/verify/login bodies use `preferredLanguage`: `"eng"` | `"fre"`

## Shared Auth Types

```ts
type AuthRole = "worker" | "employer";
type PreferredLanguage = "eng" | "fre";
type AccountStatus = "active" | "suspended" | "deactivated";

type AuthSessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  role: AuthRole;
  preferredLanguage: PreferredLanguage;
  accountStatus: AccountStatus;
  profilePhotoUrl: string | null;
  workerProfileId: string | null;
  employerProfileId: string | null;
};

type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthSessionUser;
};

type ApiMessageResponse = {
  message: string;
};
```

## Frontend Pages

### `/login`

What it does:

- Legacy route.
- Redirects to `/sign-in`.
- Preserve query params such as `callbackUrl`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/signup`

What it does:

- Legacy route.
- Redirects to `/sign-up/role`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/sign-up/role`

What it does:

- Lets the user choose `worker` or `employer`.
- Stores the chosen role locally for the next signup page.
- Does not call the backend.

Sends:

```ts
type LocalSignupIntent = {
  role: "worker" | "employer";
};
```

Receives:

- No API response.

Next route:

- `/sign-up/phone` by default.
- `/sign-up/email` if user chooses email signup.

### `/sign-up/phone`

What it does:

- Creates a pending Worker or Employer registration with phone and password.
- Sends an OTP by SMS.

API:

- `POST /auth/register`

Sends:

```ts
type RegisterWithPhoneRequest = {
  role: "worker" | "employer";
  phone: string;
  password: string;
  preferredLanguage?: "eng" | "fre";
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

Next route:

- `/sign-up/verify/phone`

### `/sign-up/email`

What it does:

- Creates a pending Worker or Employer registration with email and password.
- Sends an OTP by email.

API:

- `POST /auth/register`

Sends:

```ts
type RegisterWithEmailRequest = {
  role: "worker" | "employer";
  email: string;
  password: string;
  preferredLanguage?: "eng" | "fre";
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

Next route:

- `/sign-up/verify/email`

### `/sign-up/verify`

What it does:

- Generic helper route.
- Redirects to `/sign-up/verify/phone` or `/sign-up/verify/email` using locally stored pending signup state.
- If no pending signup exists, redirect to `/sign-up/role`.

Sends:

- Nothing.

Receives:

- Redirect only.

### `/sign-up/verify/phone`

What it does:

- Lets user enter the SMS OTP.
- Verifies registration.
- Creates the session.
- Redirects user to the correct portal.

API:

- `POST /auth/verify`

Sends:

```ts
type VerifyPhoneRequest = {
  identifier: string;
  code: string; // alias: `otp` also accepted
  purpose?: "registration";
};
```

**Important:** Do **not** send `role`, `password`, or `preferredLanguage` on verify. Those are stored server-side when the user calls `POST /auth/register` (`registration_snapshot`). Sending them returns `400` with `property X should not exist`.

Receives:

```ts
type VerifyPhoneResponse = AuthTokensResponse;
```

Redirect:

- Worker: `/worker/jobs`
- Employer: `/employer`

### `/sign-up/verify/email`

What it does:

- Lets user enter the email OTP.
- Verifies registration.
- Creates the session.
- Redirects user to the correct portal.

API:

- `POST /auth/verify`

Sends:

```ts
type VerifyEmailRequest = {
  identifier: string;
  code: string; // alias: `otp` also accepted
  purpose?: "registration";
};
```

Do **not** include `role`, `password`, or `preferredLanguage` here (see phone verify note above).

Receives:

```ts
type VerifyEmailResponse = AuthTokensResponse;
```

Redirect:

- Worker: `/worker/jobs`
- Employer: `/employer`

### `/sign-in`

What it does:

- Lets a user sign in with phone or email and password.
- Honors a safe `callbackUrl`.

API:

- `POST /auth/login`

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

Redirect:

- Safe `callbackUrl` if present and allowed for the user's role.
- Worker fallback: `/worker/jobs`
- Employer fallback: `/employer`

### `/sign-in/email`

What it does:

- Email-focused sign-in page.
- Same backend contract as `/sign-in`.

API:

- `POST /auth/login`

Sends:

```ts
type EmailLoginRequest = {
  identifier: string;
  password: string;
};
```

Receives:

```ts
type EmailLoginResponse = AuthTokensResponse;
```

### `/sign-in/phone`

What it does:

- Phone-focused helper route.
- Can render the same component as `/sign-in` or redirect to `/sign-in`.

API:

- `POST /auth/login`

Sends:

```ts
type PhoneLoginRequest = {
  identifier: string;
  password: string;
};
```

Receives:

```ts
type PhoneLoginResponse = AuthTokensResponse;
```

### `/forgot-password`

What it does:

- User enters email or phone.
- Backend sends reset OTP if the account exists.
- UI should show the same success message whether or not an account exists.

API:

- `POST /auth/forgot-password`

Sends:

```ts
type ForgotPasswordRequest = {
  identifier: string;
};
```

Receives:

```ts
type ForgotPasswordResponse = {
  message: string;
  deliveryChannel: "email" | "sms";
  otpExpiresAt?: string;
};
```

Next route:

- `/reset-password`

### `/reset-password`

What it does:

- User enters identifier, reset OTP, and new password.
- Backend updates password and clears refresh sessions.

API:

- `POST /auth/reset-password`

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
type ResetPasswordResponse = {
  message: string;
};
```

Redirect:

- `/sign-in?reset=1`

## Session API Calls

### `GET /auth/me`

What it does:

- Returns the currently authenticated user.
- Use for app bootstrap and protected route guards.

Sends:

- Bearer access token.

Receives:

```ts
type MeResponse = {
  user: AuthSessionUser;
};
```

### `POST /auth/refresh`

What it does:

- Exchanges refresh token for a new token pair.
- Backend also supports refresh token cookie.

Sends:

```ts
type RefreshRequest = {
  refreshToken?: string;
};
```

Receives:

```ts
type RefreshResponse = AuthTokensResponse;
```

### `POST /auth/logout`

What it does:

- Invalidates current refresh token if present.
- Clears backend refresh cookie.
- Frontend should also clear stored tokens.

Sends:

- Bearer access token.
- Optional refresh token cookie/body depending client storage.

Receives:

```ts
type LogoutResponse = {
  message: string;
};
```

### `POST /auth/resend-otp`

What it does:

- Resends registration or password reset OTP.

Sends:

```ts
type ResendOtpRequest = {
  identifier: string;
  purpose: "registration" | "password_reset";
};
```

Receives:

```ts
type ResendOtpResponse = {
  message: string;
  otpExpiresAt: string;
};
```

## Frontend Guard Rules

Protected route prefixes:

- `/worker`
- `/employer`

Guest-only route prefixes:

- `/sign-in`
- `/login`
- `/sign-up`
- `/signup`
- `/forgot-password`
- `/reset-password`

Rules:

- Unauthenticated user visiting protected route redirects to `/sign-in?callbackUrl=...`.
- Signed-in worker visiting `/employer/**` redirects to `/worker/jobs`.
- Signed-in employer visiting `/worker/**` redirects to `/employer`.
- Signed-in users visiting guest-only routes redirect to their portal.
