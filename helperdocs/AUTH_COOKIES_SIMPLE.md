# Auth cookies & refresh — simple guide

## Two keys, not one

When you log in, the API gives you:

1. **Access token** — short life (~15 min). Goes in the `Authorization: Bearer ...` header on every API call.
2. **Refresh token** — long life (~7 days). Used only to get a **new** access token when the old one expires.

Think of the access token as a **day pass** to a building. The refresh token is the **card in your wallet** that lets you get a new day pass without signing in again.

## What is the cookie?

The API can store the refresh token in an **httpOnly cookie** named `refreshToken`.

- The browser saves it automatically on login.
- JavaScript cannot read it (safer against theft).
- On `POST /auth/refresh`, the browser can send that cookie back.

You can **also** get `refreshToken` in the **JSON body** from login/refresh and send it in the body:

```json
{ "refreshToken": "..." }
```

That works even when cookies are awkward (localhost → Render).

## When refresh fails (401)

| Problem | What it means |
|--------|----------------|
| No cookie, no body token | Frontend did not send the refresh token. |
| Wrong `COOKIE_DOMAIN` | Cookie was never saved or not sent (e.g. `localhost` on Render). |
| Cookie `Path` too narrow | Cookie not sent to `/admin/auth/refresh` (we use `Path=/`). |
| `SameSite` too strict | Browser blocks cookie from `localhost` to `onrender.com` — use `none` on Render, or use body `refreshToken`. |
| CORS blocks origin | Browser blocks the request — use `CORS_ALLOW_ALL=true` or list your localhost URL. |
| Access token expired, admin refresh with old JWT | Admin refresh must **not** require a valid access token (fixed in API). |
| Old login before API update | No `refreshToken` in login JSON — log in again after deploy. |

## Env vars (short)

| Variable | Local `.env` | Render |
|----------|--------------|--------|
| `CORS_ALLOW_ALL` | `true` | `true` |
| `CORS_ORIGINS` | empty | empty |
| `COOKIE_DOMAIN` | **empty** | **empty** |
| `COOKIE_PATH` | `/` | `/` |
| `COOKIE_SAME_SITE` | `none` (or `lax` if API + web same machine only) | `none` or unset |
| `COOKIE_SECURE` | empty locally | empty (auto Secure in production) |

Copy-paste for Render: `.env.render.example`

## Frontend checklist

1. Login → save `accessToken` + `refreshToken` from JSON.
2. API calls → `Authorization: Bearer <accessToken>`.
3. On 401 → `POST /auth/refresh` with `{ refreshToken }` (or `credentials: 'include'` for cookies).
4. Save the **new** `refreshToken` from the refresh response (it rotates every time).
