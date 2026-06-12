# Conventions (all routes)

## Base URL

Use your deployment origin, e.g. `https://api.example.com` or `http://127.0.0.1:8000` (see `PORT` in `.env`).  
**No** `/api` or `/v1` prefix is configured unless you add `setGlobalPrefix` later.

## JSON

- Request bodies: `Content-Type: application/json` where a body is sent.
- Responses: JSON for API routes except `GET /` (HTML).

## Authentication

| Mechanism         | Where                                               | Use                                                                             |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Access JWT**    | Response body field `accessToken` on login / verify | `Authorization: Bearer <accessToken>` on protected routes                       |
| **Refresh token** | httpOnly cookie `refreshToken`, `Path=/auth`        | Sent by the browser on `POST /auth/refresh` when using `credentials: 'include'` |

Protected routes use `JwtAuthGuard` — missing or invalid Bearer → **401**.

Role-scoped routes also use `RolesGuard` — wrong role → **403**.

## Cross-origin (browsers)

`CORS` is enabled with `credentials: true`. The frontend origin must be listed in `CORS_ORIGINS` (comma-separated) when not in permissive dev mode.

## Validation errors (Nest)

Typical shape:

```json
{
  "statusCode": 400,
  "message": ["field must be longer than ..."],
  "error": "Bad Request"
}
```

`message` may be a string or an array of strings depending on the failure.

## Rate limiting

`@nestjs/throttler` is applied globally and **tighter limits** are set on several **`/auth`** routes (per route; see [02-auth.md](./02-auth.md)).  
Exceeded limits → **429** with message like _Too many requests…_.

## Source of truth

Route paths and DTOs are defined under `src/modules/*/controllers/*.ts` and `src/modules/*/dto/*.ts`. This documentation should be updated when those change.
