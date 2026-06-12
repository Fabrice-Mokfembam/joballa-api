# System / health — root

Controller: `src/modules/health/controllers/health.controller.ts`

---

## `GET /`

| | |
| --- | --- |
| **Auth** | None |
| **Content-Type** | `text/html` |

Returns a small HTML “terminal” status page (“Joballa backend is running…”).

Used for manual checks and load balancers that expect **`200`** from `/`.

---

## Route matrix (implemented HTTP APIs)

Quick reference — JSON APIs only:

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/auth/register` | Public |
| POST | `/auth/verify` | Public (+ cookie set) |
| POST | `/auth/login` | Public (+ cookie set) |
| POST | `/auth/refresh` | Cookie |
| POST | `/auth/logout` | Bearer |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| POST | `/auth/resend-otp` | Public |
| GET | `/auth/me` | Bearer |
| GET | `/worker-profiles/me` | Bearer + WORKER |
| PATCH | `/worker-profiles/me` | Bearer + WORKER |
| GET | `/employer-profiles/me` | Bearer + EMPLOYER |
| PATCH | `/employer-profiles/me` | Bearer + EMPLOYER |
