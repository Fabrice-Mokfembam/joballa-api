# Joballa Backend

This repository contains the Joballa backend API. It is a NestJS modular monolith designed so the frontend communicates with it only through HTTP routes.

## Architecture

The backend is organized by business domain, not by user role.

- `auth` handles authentication and authorization concerns.
- `users` owns the base user record and shared account metadata.
- `worker-profiles` owns worker professional profile data.
- `employer-profiles` owns employer company and department data.
- `jobs` owns job posting and publishing.
- `applications` owns job applications and profile snapshots.
- `engagements` owns hired worker tracking and shift logs.
- `payments` owns payroll and payment flows.
- `notifications` owns in-app, email, SMS, and real-time delivery.
- `files` owns uploads and document storage concerns.
- `admin-review` owns verification, moderation, and dispute workflows.
- `reports` owns reporting and export use cases.
- `ai` owns recommendation, matching, and fraud-signal features.

This gives us one deployable backend with clear internal boundaries.

## Which Files Expose Routes

The files that expose routes are the files inside each module's `controllers/` folder.

Examples:

- `src/modules/health/controllers/health.controller.ts`
- `src/modules/jobs/controllers/jobs.controller.ts`
- `src/modules/auth/controllers/auth.controller.ts`

In NestJS, a route is exposed by controller classes that use decorators like:

- `@Controller()`
- `@Get()`
- `@Post()`
- `@Patch()`
- `@Delete()`

So if someone asks, "Where is the route defined?", the answer should almost always be: check the module's `controllers/` folder first.

## Folder Structure

```text
src/
  app.module.ts
  main.ts
  common/
  config/
  prisma/
  modules/
    README.md
    health/
      controllers/
      services/
      dto/
      entities/
      repositories/
      policies/
      health.module.ts
      health.constants.ts
    auth/
      controllers/
      services/
      dto/
      entities/
      repositories/
      policies/
      auth.module.ts
      auth.constants.ts
    users/
    worker-profiles/
    employer-profiles/
    jobs/
    applications/
    engagements/
    payments/
    notifications/
    files/
    admin-review/
    reports/
    ai/
```

## How The Pieces Work Together

### `src/main.ts`

This is the application entrypoint. It starts NestJS and listens for HTTP requests.

### `src/app.module.ts`

This is the root module. It imports all feature modules so they become part of the application.

### `src/modules/<feature>`

Each module owns one business area.

- `controllers/` receive requests from the frontend and return responses.
- `services/` contain the use-case logic.
- `dto/` define request and response payloads.
- `entities/` hold domain-facing structures.
- `repositories/` handle persistence access.
- `policies/` hold authorization and business rules.
- `<feature>.module.ts` registers the module.
- `<feature>.constants.ts` contains module-level constants.

### `src/prisma`

This is shared database infrastructure. It provides the Prisma client to the rest of the application.

### `src/common`

This is for reusable cross-cutting code shared by multiple modules, such as guards, filters, decorators, pipes, or utility helpers.

### `src/config`

This is where environment configuration and app configuration should live.

## Request Flow

For a future route like `POST /jobs`, the request should move through the backend like this:

1. `jobs.controller.ts` receives the HTTP request.
2. A DTO validates the incoming payload.
3. `JobsService` runs the business logic.
4. Policies check permissions or business constraints.
5. A repository saves or fetches data.
6. The controller returns the response.

That separation keeps controllers thin and the business logic reusable.

## Responsibility Rules

- Controllers expose routes.
- Services orchestrate use cases.
- Repositories talk to Prisma or the database.
- DTOs define payload contracts.
- Policies enforce permissions and business rules.
- Controllers should not contain heavy business logic.
- Controllers should not call Prisma directly.

## Team docs

- [docs/README.md](docs/README.md) — **backend:** all implemented HTTP routes (auth, profiles, system)
- [helper docs/frontend-authentication-guide.md](helper%20docs/frontend-authentication-guide.md) — **frontend** auth (cookies, payloads, flows)

## Current HTTP surface

Authoritative list: [docs/README.md](docs/README.md) and [docs/routes/](docs/routes/).

## Development Workflow, Branching & Team Onboarding

This project uses **Git Flow** paired with **Neon Database Branching** to ensure that we never break the production environment and can work on features in isolation.

### Branching Strategy

| Branch        | Target             | Purpose                                                     |
| :------------ | :----------------- | :---------------------------------------------------------- |
| `main`        | **Production**     | Stable, live code. Do not push directly here.               |
| `development` | **Staging/Shared** | Base branch for all features. Syncs with Neon `dev-shared`. |
| `feat/[name]` | **Local Dev**      | Your personal working branch.                               |

### First-Time Setup For New Teammates

If you are just joining the project, follow these steps to get running:

1. **Clone and Branch:**

   ```bash
   git clone <repo-url>
   cd joballa-backend
   git checkout development
   ```

2. **Install Dependencies:**

```bash
npm install
```

3. **Setup Your Private Database:**

- Log into the Neon Console.

- Locate the dev-shared branch.

- Create a New Branch from dev-shared named db-[your-name].

- Copy your unique connection string.

4. **Environment Variables:**

- Copy .env.example to .env.

- Paste your Neon connection string into the DATABASE_URL variable.

5. **Initialize Prisma:**

```bash
# Generates the TS Client and applies existing migrations to your new branch
npm run prisma:generate
npm run prisma:migrate:deploy
```

### First-Time Setup For Existing Teammates (Syncing latest changes)

If you already have the repo but need to pull the latest updates (e.g., new models or logic) from the team:

1. **Fetch the new branch:**

```bash
git fetch origin
```

2. **Switch to Development:**

```bash
 git checkout development
```

3. **Update local code**

```bash
 git pull origin development
```

4. **Setup Your Private Database:**

- Log into the Neon Console.

- Locate the dev-shared branch.

- Create a New Branch from dev-shared named db-[your-name].

- Copy your unique connection string.

5. **Update Environment Variables:**

- Paste your Neon connection string into the DATABASE_URL variable.

6. **Sync Database and Types**

```bash
npm run prisma:migrate:deploy
npm run prisma:generate
```

## Database guide

For schema changes, migrations, and database syncing:

- [prisma/README.md](prisma/README.md)

## Recommended Next Modules To Implement

The best next modules to flesh out are:

1. `auth`
2. `users`
3. `worker-profiles`
4. `jobs`

Those will define the core API contracts that your frontend will consume first.

npx prisma migrate deploy
npm run create:admin -- --email=superadmin@joballa.cm --password="YourPass123!" --role=super_admin
npm run dev   # restart if already running — picks up new AdminV2Module