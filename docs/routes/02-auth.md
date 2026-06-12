# Auth routes — `/auth`

Controller: `src/modules/auth/controllers/auth.controller.ts`  
All paths below are relative to the server root (e.g. `POST /auth/login`).

**Public signup** only allows roles **`WORKER`** and **`EMPLOYER`** (`ADMIN` / `SUPER_ADMIN` are rejected on register/verify).

---

## `POST /auth/register`

Sends a **registration OTP**. Does **not** create a user until `/auth/verify`.

| | |
| --- | --- |
| **Auth** | None |
| **HTTP** | **200** on success |

**Body**

| Field | Required | Notes |
| --- | --- | --- |
| `email` | XOR with `phone` | Exactly one of `email` or `phone`. Email max 255, normalized. |
| `phone` | XOR with `email` | Max 32 chars; spaces stripped server-side for canonical form. |
| `password` | Yes | 8–128 chars |
| `role` | Yes | `WORKER` or `EMPLOYER` (enum `Role`) |
| `languagePreference` | No | `EN` or `FR` |

**Success (200)** — example:

```json
{
  "message": "Verification code sent. Please check your email/phone.",
  "identifier": "user@example.com"
}
```

Use returned **`identifier`** (canonical) in `/auth/verify` and resend calls.

**Errors:** `400` (validation / XOR contact); `409` (user already exists for that contact); `429` (throttle).  
**Throttle:** 5 requests / 15 minutes (per default limit in controller).

---

## `POST /auth/verify`

Completes registration: validates OTP, creates **verified** user, issues **access** JWT and **refresh** cookie.

| | |
| --- | --- |
| **Auth** | None |
| **HTTP** | **201** on success |
| **Cookie** | Sets `refreshToken` (httpOnly). Browsers should use `credentials: 'include'`. |

**Body**

| Field | Required | Notes |
| --- | --- | --- |
| `identifier` | Yes | Canonical from `/auth/register` response |
| `otp` | Yes | Six digits, string `^[0-9]{6}$` |
| `role` | Yes | Must match registration intent (`WORKER` / `EMPLOYER`) |
| `password` | Yes | 8–128 chars; becomes account password |
| `languagePreference` | No | `EN` / `FR`; should match registration snapshot |

**Success (201)**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "<uuid>",
    "role": "WORKER",
    "email": "user@example.com",
    "phone": null,
    "languagePreference": "EN",
    "verificationStatus": "VERIFIED"
  }
}
```

Phone-only signup: `email` may be `null`; identifier was phone.

**Errors:** `400` (OTP, mismatch, expiry); `409` (account exists); `429`.

**Throttle:** 10 / 15 minutes.

---

## `POST /auth/login`

| | |
| --- | --- |
| **Auth** | None |
| **HTTP** | **200** |
| **Cookie** | Sets/refreshes `refreshToken` |

**Body**

| Field | Required |
| --- | --- |
| `identifier` | Yes — email or phone (same rules as signup) |
| `password` | Yes |

**Success (200)**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "<uuid>",
    "role": "WORKER",
    "email": "user@example.com",
    "phone": null,
    "languagePreference": "EN"
  }
}
```

**Errors:** `401` invalid credentials / inactive user; `403` account not verified; `429`.

**Throttle:** 10 / 15 minutes.

---

## `POST /auth/refresh`

Issues a **new** access token and **rotates** the refresh cookie.

| | |
| --- | --- |
| **Auth** | None — uses **`refreshToken`** cookie |
| **HTTP** | **200** |
| **Body** | Optional empty object `{}` |

**Success (200)**

```json
{
  "accessToken": "<new jwt>"
}
```

**Errors:** `401` missing/invalid/expired refresh.

**Throttle:** 30 / 60 seconds.

---

## `POST /auth/logout`

| | |
| --- | --- |
| **Auth** | **Bearer** access JWT required |
| **Cookie** | Should send `credentials: 'include'` so server can clear refresh cookie |

**Body:** none.

**Success (200)**

```json
{
  "message": "Logged out"
}
```

**Throttle:** 60 / 60 seconds.

---

## `POST /auth/forgot-password`

Sends password-reset OTP if a **verified** user exists (response does not reveal existence).

**Body**

| Field | Required |
| --- | --- |
| `identifier` | Yes — email or phone |

**Success (200)**

```json
{
  "message": "If an account exists for this email/phone, a reset code has been sent."
}
```

**Throttle:** 5 / 15 minutes.

---

## `POST /auth/reset-password`

**Body**

| Field | Required | Notes |
| --- | --- | --- |
| `identifier` | Yes | Same as forgot step |
| `otp` | Yes | Six digits |
| `newPassword` | Yes | 8–128 chars |

**Success (200)**

```json
{
  "message": "Password updated"
}
```

Revokes refresh sessions server-side — user must log in again.

**Errors:** `400` invalid/expired OTP, etc.

**Throttle:** 10 / 15 minutes.

---

## `POST /auth/resend-otp`

**Body**

| Field | Required | Notes |
| --- | --- | --- |
| `identifier` | Yes | Canonical email or phone |
| `purpose` | Yes | Prisma enum: `REGISTRATION` or `PASSWORD_RESET` |

**Success (200)** — shape includes `message` and usually `identifier` (see implementation for password-reset copy).

Resend limits apply server-side (e.g. 3/hour per purpose+identifier) plus **429** throttling global.

**Throttle:** 20 / 15 minutes.

---

## `GET /auth/me`

| | |
| --- | --- |
| **Auth** | **Bearer** JWT |

**Success (200)** — extended profile summary, e.g.:

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "phone": null,
    "role": "WORKER",
    "languagePreference": "EN",
    "verificationStatus": "VERIFIED",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "dashboardRoute": "/worker",
  "profileType": "WORKER",
  "profile": {}
}
```

`profile` is worker or employer shaped when present.

**Errors:** `401`; `404` if user record is missing (edge).

---

## `POST /auth/select-role`

Onboarding: update **language** and/or **display name** for the signed-in user when `role` matches the account (`WORKER` or `EMPLOYER`). Returns the same JSON shape as **`GET /auth/me`**.

| | |
| --- | --- |
| **Auth** | **Bearer** JWT |
| **HTTP** | **200** |

**Body**

| Field | Required | Notes |
| --- | --- | --- |
| `role` | Yes | Must equal the user’s current role (`WORKER` or `EMPLOYER`) |
| `name` | No | Employer → `companyName`; worker → `fullName` |
| `languagePreference` | No | `EN` / `FR` |

**Success (200):** same as `GET /auth/me`.

**Errors:** `400` (role mismatch); `401`; `404` user missing (edge).

**Throttle:** 30 / 15 minutes.
