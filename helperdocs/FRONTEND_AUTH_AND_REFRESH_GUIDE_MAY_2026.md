# Joballa — Frontend Auth & Refresh Guide

**Last updated:** May 25, 2026  
**Production API:** [https://joballa-api.onrender.com](https://joballa-api.onrender.com)  
**Audience:** Frontend developers (worker, employer, and admin portals)

This document is the **single source of truth** for login, refresh, logout, and session handling. Portal-specific guides link here for auth.

**Related**

- [FRONTEND_WORKER_PORTAL_API_GUIDE_MAY_2026.md](./FRONTEND_WORKER_PORTAL_API_GUIDE_MAY_2026.md) — `/api/worker/*`
- [FRONTEND_EMPLOYER_PORTAL_API_GUIDE_MAY_2026.md](./FRONTEND_EMPLOYER_PORTAL_API_GUIDE_MAY_2026.md) — `/api/employer/*`
- [FRONTEND_ADMIN_PANEL_API_GUIDE_MAY_2026.md](./FRONTEND_ADMIN_PANEL_API_GUIDE_MAY_2026.md) — `/admin/*`
- [AUTH_COOKIES_SIMPLE.md](./AUTH_COOKIES_SIMPLE.md) — short troubleshooting reference

---

## Table of contents

1. [Quick start (do this)](#1-quick-start-do-this)
2. [Two tokens explained](#2-two-tokens-explained)
3. [Which refresh URL per portal](#3-which-refresh-url-per-portal)
4. [Login & verify responses](#4-login--verify-responses)
5. [Refresh session](#5-refresh-session)
6. [Logout](#6-logout)
7. [Recommended client implementation](#7-recommended-client-implementation)
8. [Cookies vs JSON body](#8-cookies-vs-json-body)
9. [CORS & localhost](#9-cors--localhost)
10. [Errors & debugging](#10-errors--debugging)
11. [Admin panel differences](#11-admin-panel-differences)
12. [Checklist before demo](#12-checklist-before-demo)

---

## 1. Quick start (do this)

**Minimum flow that works for localhost → production API:**

1. **Login** → read `accessToken` and `refreshToken` from the JSON body.
2. **Store both** (memory, `sessionStorage`, or `localStorage` for demos).
3. **Every API call** → `Authorization: Bearer <accessToken>`.
4. **On 401** → call refresh once with the body (see below), save the **new** tokens, retry the failed request.
5. **If refresh returns 401** → clear storage and send the user to login.

You do **not** need cookies for this flow. Cookies are optional.

```http
POST https://joballa-api.onrender.com/auth/login
Content-Type: application/json

{ "identifier": "user@example.com", "password": "your-password" }
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
  "user": { "id": "...", "role": "WORKER", "email": "...", ... }
}
```

```http
POST https://joballa-api.onrender.com/auth/refresh
Content-Type: application/json

{ "refreshToken": "550e8400-e29b-41d4-a716-446655440000" }
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "new-uuid-after-rotation"
}
```

**Important:** Each refresh returns a **new** `refreshToken`. Always replace the stored value. The old refresh token is invalidated.

---

## 2. Two tokens explained

| Token | Lifetime (default) | Where it goes | Purpose |
|-------|-------------------|---------------|---------|
| **Access token** | ~15 minutes (`JWT_ACCESS_EXPIRES_SEC`) | `Authorization: Bearer ...` header | Proves who you are on every API call |
| **Refresh token** | ~7 days (`JWT_REFRESH_EXPIRES_SEC`) | JSON body on refresh (recommended), or httpOnly cookie | Gets a new access token when the short one expires |

**Analogy:** Access token = day pass. Refresh token = card that gets you a new day pass without typing your password again.

When the access token expires, protected routes return **401 Unauthorized**. That is normal. Call **refresh** — do not send the user to login until refresh fails.

---

## 3. Which refresh URL per portal

| Portal | Login | Refresh | Logout | Me / profile |
|--------|-------|---------|--------|----------------|
| **Worker** | `POST /auth/login` | `POST /auth/refresh` | `POST /auth/logout` | `GET /auth/me` |
| **Employer** | `POST /auth/login` | `POST /auth/refresh` | `POST /auth/logout` | `GET /auth/me` then `GET /api/employer/me` |
| **Admin** | `POST /admin/auth/login` | `POST /admin/auth/refresh` | `POST /admin/auth/logout` | `GET /admin/auth/me` |

Worker and employer share **`/auth/*`**. Admin uses **`/admin/auth/*`** but the same token shape (`accessToken` + `refreshToken` in JSON).

**Admin refresh does not require a valid access token.** You can call it when the access token is already expired (only the refresh token is needed).

---

## 4. Login & verify responses

### Worker / employer — `POST /auth/login`

```http
POST /auth/login
Content-Type: application/json
```

| Field | Required |
|-------|----------|
| `identifier` | Yes — email or phone |
| `password` | Yes |

**Success `200`:**

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-uuid>",
  "user": {
    "id": "<uuid>",
    "role": "WORKER",
    "email": "user@example.com",
    "phone": null,
    "languagePreference": "EN"
  }
}
```

`role` may be `WORKER` or `EMPLOYER`. Use it to route the user to the correct app.

**Errors:** `401` wrong password / inactive; `403` account not verified (finish `/auth/verify` first).

### Registration — `POST /auth/verify`

Same token shape as login, HTTP **201**:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-uuid>",
  "user": {
    "id": "<uuid>",
    "role": "EMPLOYER",
    "verificationStatus": "VERIFIED",
    ...
  }
}
```

### Admin — `POST /admin/auth/login`

**Success `200`** — wrapped for admin UI:

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<opaque-uuid>",
    "user": {
      "id": "<uuid>",
      "email": "admin@joballa.cm",
      "role": "admin"
    }
  },
  "message": "Signed in successfully."
}
```

Read tokens from **`response.data`**, not the top level.

---

## 5. Refresh session

### Worker / employer — `POST /auth/refresh`

| | |
|---|---|
| **Auth** | None (do not send expired Bearer token as a requirement) |
| **HTTP** | `200` |

**Option A — recommended (JSON body):**

```http
POST /auth/refresh
Content-Type: application/json

{ "refreshToken": "<stored-refresh-token>" }
```

**Option B — cookie:**

```http
POST /auth/refresh
Content-Type: application/json

{}
```

Browser must send the httpOnly `refreshToken` cookie:

```javascript
fetch(`${API_URL}/auth/refresh`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
```

**Success `200`:**

```json
{
  "accessToken": "<new-jwt>",
  "refreshToken": "<new-opaque-uuid>"
}
```

### Admin — `POST /admin/auth/refresh`

Same body as above. Success is wrapped:

```json
{
  "success": true,
  "data": {
    "accessToken": "<new-jwt>",
    "refreshToken": "<new-opaque-uuid>"
  },
  "message": "Session refreshed."
}
```

**Errors:** `401` — missing refresh token, invalid token, or expired (user must log in again).

**Throttle:** 30 requests / 60 seconds per IP.

---

## 6. Logout

### Worker / employer — `POST /auth/logout`

Requires a valid **access** token:

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

Optional body if you use JSON refresh storage:

```json
{ "refreshToken": "<stored-refresh-token>" }
```

**Success `200`:** `{ "message": "Logged out" }`

Clear `accessToken` and `refreshToken` in the client after success.

### Admin — `POST /admin/auth/logout`

```http
POST /admin/auth/logout
Authorization: Bearer <accessToken>
```

Wrapped success: `{ "success": true, "data": { "loggedOut": true }, ... }`

---

## 7. Recommended client implementation

### 7.1 Storage keys (example)

```text
joballa_access_token
joballa_refresh_token
```

### 7.2 API client with auto-refresh (fetch)

```typescript
const API_URL = import.meta.env.VITE_API_URL ?? 'https://joballa-api.onrender.com';

function getAccessToken() {
  return localStorage.getItem('joballa_access_token');
}
function getRefreshToken() {
  return localStorage.getItem('joballa_refresh_token');
}
function setTokens(access: string, refresh: string) {
  localStorage.setItem('joballa_access_token', access);
  localStorage.setItem('joballa_refresh_token', refresh);
}
function clearTokens() {
  localStorage.removeItem('joballa_access_token');
  localStorage.removeItem('joballa_refresh_token');
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(isAdmin = false): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const path = isAdmin ? '/admin/auth/refresh' : '/auth/refresh';
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const json = await res.json();
  // Admin: { success, data: { accessToken, refreshToken } }
  const payload = json.data ?? json;
  setTokens(payload.accessToken, payload.refreshToken);
  return payload.accessToken;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts?: { isAdmin?: boolean; skipAuth?: boolean },
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!opts?.skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !opts?.skipAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken(opts?.isAdmin).finally(() => {
        refreshPromise = null;
      });
    }
    const newAccess = await refreshPromise;
    if (!newAccess) return res;

    headers.set('Authorization', `Bearer ${newAccess}`);
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  }

  return res;
}
```

### 7.3 Login helper (worker / employer)

```typescript
export async function login(identifier: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  setTokens(data.accessToken, data.refreshToken);
  return data;
}
```

### 7.4 Login helper (admin)

```typescript
export async function adminLogin(identifier: string, password: string) {
  const res = await fetch(`${API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  const json = await res.json();
  setTokens(json.data.accessToken, json.data.refreshToken);
  return json.data;
}
```

### 7.5 Axios (optional)

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) throw error;
    original._retry = true;
    const access = await refreshAccessToken(original.url?.includes('/admin/'));
    if (!access) throw error;
    original.headers.Authorization = `Bearer ${access}`;
    return api(original);
  },
);
```

---

## 8. Cookies vs JSON body

| Approach | When to use |
|----------|-------------|
| **JSON `refreshToken` in body** | **Default for Joballa frontends.** Works from `http://localhost:3000` to production API. |
| **httpOnly cookie** | Optional extra; requires `credentials: 'include'` on login and refresh. |

The API always returns `refreshToken` in the login/refresh JSON (May 2026+). **Store it in the client** even if you also use cookies.

Cookie name: `refreshToken`  
Cookie path: `/` (sent to both `/auth/refresh` and `/admin/auth/refresh`)

---

## 9. CORS & localhost

The production API is configured to **allow any origin** when `CORS_ALLOW_ALL=true` (reflects your `Origin` header). You can develop from:

- `http://localhost:3000`
- `http://localhost:5173`
- staging / production web URLs

You do **not** need to change backend env vars from the frontend repo.

**If the browser blocks a request before it hits the API**, check the browser console for CORS errors and confirm your app uses the correct `API_URL`.

For **cookie-only** refresh from localhost to Render, the browser needs cross-site cookies (`SameSite=None; Secure` on the API). Prefer **body `refreshToken`** to avoid that complexity.

---

## 10. Errors & debugging

| Status | Meaning | Frontend action |
|--------|---------|-----------------|
| **401** on protected route | Access token missing, invalid, or expired | Try refresh once, then retry |
| **401** on `/auth/refresh` | Refresh token missing, invalid, or expired | Clear tokens → login page |
| **403** on login | Account not verified | Show verify / OTP screen |
| **403** on `/api/*` | Wrong role (e.g. worker token on employer route) | Login with correct account |

### Common mistakes

1. **Not saving `refreshToken` from login** — only storing `accessToken`.
2. **Not updating `refreshToken` after refresh** — old token is dead after rotation.
3. **Calling admin refresh with Bearer only** — refresh needs `refreshToken` in body (or cookie), not a valid access token.
4. **Sending user to login on first 401** — try refresh first.
5. **Using old API deploy** — login without `refreshToken` in JSON; redeploy and log in again.

### Quick test (browser console)

After login, run:

```javascript
await fetch('https://joballa-api.onrender.com/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: '<paste from login>' }),
}).then((r) => r.json());
```

You should get a new `accessToken` and `refreshToken`.

---

## 11. Admin panel differences

| Topic | Worker / employer | Admin |
|-------|-------------------|-------|
| Login path | `/auth/login` | `/admin/auth/login` |
| Refresh path | `/auth/refresh` | `/admin/auth/refresh` |
| Response wrapper | Flat JSON | `{ success, data, message }` |
| Role in JWT | `WORKER`, `EMPLOYER` | `ADMIN`, `SUPER_ADMIN` |
| Portal routes | `/api/worker/*`, `/api/employer/*` | `/admin/*` |

Pass `isAdmin: true` (or equivalent) in your refresh helper when the app is the admin panel.

---

## 12. Checklist before demo

- [ ] `VITE_API_URL` (or equivalent) points to `https://joballa-api.onrender.com` (or your local API for local-only tests).
- [ ] Login stores **`accessToken` and `refreshToken`**.
- [ ] HTTP client attaches **`Authorization: Bearer`** on portal routes.
- [ ] **401 handler** calls refresh **once**, then retries or redirects to login.
- [ ] After refresh, **`refreshToken` is updated** in storage.
- [ ] Admin app uses **`/admin/auth/refresh`** and reads **`data.accessToken`**.
- [ ] Users **log in again** after backend deploy (old sessions may lack `refreshToken` in JSON).
- [ ] Logout clears both tokens client-side.

---

## Document history

| Date | Change |
|------|--------|
| May 25, 2026 | Initial guide: body + cookie refresh, all portals, sample client code, localhost → Render |
