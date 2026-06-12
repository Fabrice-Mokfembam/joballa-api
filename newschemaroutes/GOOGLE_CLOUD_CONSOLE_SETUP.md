# Google Cloud Console Setup — Joballa Google Sign-In

**Date:** June 2026  
**For:** Whoever manages Google Cloud / DevOps / backend env  
**Used by:** Worker & employer SPA only (not admin)

After this guide you will have:

- A **Web client ID** → frontend `VITE_GOOGLE_CLIENT_ID`  
- The same ID → backend `GOOGLE_CLIENT_ID` on Render/local `.env`

---

## Prerequisites

- A Google account (personal or company)  
- Access to [Google Cloud Console](https://console.cloud.google.com/)  
- Your frontend URLs (local + production), e.g.:  
  - `http://localhost:5173` or `http://localhost:3000`  
  - `https://app.joballa.com` (replace with real domain)

---

## Step 1 — Create or select a project

1. Open [https://console.cloud.google.com/](https://console.cloud.google.com/)  
2. Top bar → **Select a project** → **New Project**  
3. Name: `Joballa` (or `Joballa Production`)  
4. Click **Create**  
5. Wait until the project is selected in the top bar  

---

## Step 2 — Configure OAuth consent screen

Google requires this before OAuth client IDs work for real users.

1. Left menu → **APIs & Services** → **OAuth consent screen**  
2. User type:  
   - **External** — for any Google account (typical for Joballa)  
   - Internal — only if you use Google Workspace and want org-only  
3. Click **Create**  

### App information

| Field | Suggested value |
| --- | --- |
| App name | `Joballa` |
| User support email | your email |
| App logo | optional Joballa logo |

### App domain (optional for testing)

| Field | Value |
| --- | --- |
| Application home page | `https://joballa.com` |
| Privacy policy | your privacy URL (required before **Production**) |
| Terms of service | optional |

### Developer contact

- Add your email → **Save and Continue**

### Scopes

1. Click **Add or Remove Scopes**  
2. For ID token flow you only need **default OpenID scopes** (email, profile, openid) — usually pre-selected when using Google Identity Services  
3. Minimum scopes:  
   - `.../auth/userinfo.email`  
   - `.../auth/userinfo.profile`  
   - `openid`  
4. **Save and Continue**

### Test users (while app is in "Testing")

While status is **Testing**, only listed test users can sign in.

1. **Add users** → add Gmail addresses of testers (your team)  
2. **Save and Continue** → **Back to Dashboard**

> **Publishing:** When ready for public launch, click **Publish App**. Google may require privacy policy + verification if you request sensitive scopes (you should not need extra scopes for basic sign-in).

---

## Step 3 — Create OAuth 2.0 Client ID (Web)

1. Left menu → **APIs & Services** → **Credentials**  
2. **+ Create Credentials** → **OAuth client ID**  
3. Application type: **Web application**  
4. Name: `Joballa Web`  

### Authorized JavaScript origins

Add every origin where the SPA is served (no trailing slash):

```
http://localhost:5173
http://localhost:3000
http://127.0.0.1:5173
https://your-production-frontend-domain.com
```

> **Important:** Origins must match exactly (scheme + host + port). `http://localhost:5173` ≠ `http://127.0.0.1:5173` — add both if you use both.

### Authorized redirect URIs

For **`@react-oauth/google` One Tap / button (ID token flow)**, redirect URIs are often **not required** — the popup posts the credential to your JS callback.

Still add these for compatibility / future OAuth redirect use:

```
http://localhost:5173
https://your-production-frontend-domain.com
```

5. Click **Create**  
6. Copy the **Client ID** — looks like:  
   `123456789012-abcdefghijklmnop.apps.googleusercontent.com`

**Do not commit the Client Secret to the frontend.** For ID token verification on the backend you only need the **Client ID** (not the secret).

---

## Step 4 — Configure the backend (Render / local)

### Local `.env`

```env
GOOGLE_CLIENT_ID="385862273586-6mebf3og07du33844gcjui5mm2o4n66n.apps.googleusercontent.com"
```

Optional — multiple client IDs (web + Android + iOS), comma-separated:

```env
GOOGLE_CLIENT_IDS="385862273586-6mebf3og07du33844gcjui5mm2o4n66n.apps.googleusercontent.com"
```

Restart the API after changing env vars.

### Render (production)

1. Open your `joballa-api` service on Render  
2. **Environment** → Add variable:  
   - Key: `GOOGLE_CLIENT_ID`  
   - Value: (same Web client ID)  
3. **Save** → redeploy  

### Run database migration

On deploy (or locally):

```bash
npx prisma migrate deploy
```

Migration: `20260610120000_google_signin_worker_employer`  
(adds `users.google_id`, makes `password_hash` nullable)

---

## Step 5 — Configure the frontend

In the frontend repo `.env`:

```env

VITE_API_URL="https://joballa-api.onrender.com"
```

Rebuild/restart the frontend dev server after adding env vars.

---

## Step 6 — Verify end-to-end

### Quick API test (optional)

1. Use the frontend Google button once and copy `idToken` from network tab, **or** use Google OAuth Playground (advanced).  
2. Call:

```bash
curl -X POST http://127.0.0.1:8000/auth/google \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"PASTE_TOKEN\",\"mode\":\"signup\",\"role\":\"worker\"}"
```

Expect `200` with `accessToken`, `refreshToken`, `user`.

### Common failures

| Symptom | Fix |
| --- | --- |
| `Invalid Google token` / audience mismatch | `GOOGLE_CLIENT_ID` on API must match `VITE_GOOGLE_CLIENT_ID` exactly |
| Google popup: `origin_mismatch` | Add your dev URL to **Authorized JavaScript origins** |
| `Access blocked: app has not completed verification` | Add your Gmail as **Test user** while app is in Testing mode |
| `Google Sign-In is not configured on the server` | Set `GOOGLE_CLIENT_ID` on API and redeploy |
| CORS errors | Ensure API CORS allows frontend origin + `credentials` |

---

## Step 7 — Mobile apps (later)

When you add React Native / Expo:

1. **Credentials** → **Create OAuth client ID**  
2. Type: **Android** (package name + SHA-1) or **iOS** (bundle ID)  
3. Add those client IDs to backend:  

```env
GOOGLE_CLIENT_IDS="web-id.apps.googleusercontent.com,android-id.apps.googleusercontent.com"
```

Frontend mobile SDK sends the same `idToken` to `POST /auth/google`.

---

## Step 8 — Security checklist

- [ ] Web client ID in frontend env only — never the client **secret** in SPA  
- [ ] Backend verifies every `idToken` with `google-auth-library`  
- [ ] `GOOGLE_CLIENT_ID` set on production API  
- [ ] OAuth consent screen published before public launch  
- [ ] Privacy policy URL added before publishing  
- [ ] Admin auth remains password-only (separate `admin_accounts` table)  

---

## Step 9 — What you should have at the end

| Item | Where |
| --- | --- |
| Google Cloud project | `Joballa` |
| OAuth consent screen | Configured (Testing or Production) |
| Web OAuth Client ID | Credentials page |
| `GOOGLE_CLIENT_ID` | API `.env` + Render |
| `VITE_GOOGLE_CLIENT_ID` | Frontend `.env` |
| DB migration applied | `users.google_id` column exists |

---

## Quick reference — env vars

| Variable | Where | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Backend | Verify `idToken` audience |
| `GOOGLE_CLIENT_IDS` | Backend | Optional extra audiences (mobile) |
| `VITE_GOOGLE_CLIENT_ID` | Frontend | Google OAuth provider |

---

## Support links

- [Google Identity — Sign in with Google](https://developers.google.com/identity/gsi/web/guides/overview)  
- [@react-oauth/google](https://www.npmjs.com/package/@react-oauth/google)  
- Frontend integration: [FRONTEND_GOOGLE_SIGNIN.md](./FRONTEND_GOOGLE_SIGNIN.md)  
- Architecture plan: [GOOGLE_SIGNIN_WORKER_EMPLOYER_PLAN.md](./GOOGLE_SIGNIN_WORKER_EMPLOYER_PLAN.md)
