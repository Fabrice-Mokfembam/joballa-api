# Backend API documentation

Reference for **HTTP routes currently implemented** in this NestJS app. There is no global URL prefix (paths are `/auth/...`, `/worker-profiles/...`, etc.).

---

## Contents

| Doc | Scope |
| --- | --- |
| [routes/01-conventions.md](routes/01-conventions.md) | Base URL, auth model, cookies, errors, rate limits |
| [routes/02-auth.md](routes/02-auth.md) | **`/auth`** — registration OTP, login, refresh, logout, password reset |
| [routes/03-worker-profiles.md](routes/03-worker-profiles.md) | **`/worker-profiles`** — worker `me` CRUD-lite |
| [routes/04-employer-profiles.md](routes/04-employer-profiles.md) | **`/employer-profiles`** — employer `me` CRUD-lite |
| [routes/05-system.md](routes/05-system.md) | **`GET /`** — status terminal page |

Other modules (`jobs`, `applications`, …) are scaffolded but **do not expose controllers yet**.

---

## See also

- Frontend auth integration (cookies, payloads, UX): [**helper docs/frontend-authentication-guide.md**](../helper%20docs/frontend-authentication-guide.md)
- Password reset UX only: [**helper docs/password-reset-flow.md**](../helper%20docs/password-reset-flow.md)
- Schema & migrations: [**prisma/README.md**](../prisma/README.md)
