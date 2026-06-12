# Database Guide

This file explains how our database setup works, how to change the schema, and how to keep the database in sync as a team.

The goal is to keep this simple.

## Important Files

- `prisma/schema.prisma`
  This is the main Prisma schema file.
  It describes our database tables, fields, enums, and relations.

- `helperdocs/DATABASE_SCHEMA_CHANGELOG_MAY_2026.md`
  Summary of the latest schema alignment migration.

- `prisma/migrations/`
  This folder stores the migration history.
  Each migration is a snapshot of a database change.

- `.env`
  This stores the real database connection string and app port for your local machine.

- `.env.example`
  This shows which environment variables are needed, without exposing secrets.

## Simple Idea

Think of it like this:

- `schema.prisma` is the plan
- the database is the real building
- migrations are the construction steps that turn the plan into reality

If you change `schema.prisma` but do not run a migration, the code and the database will not match.

## Current Sample Tables

Right now, the project has these sample models:

- `User`
- `WorkerProfile`
- `EmployerProfile`
- `Job`
- `Application`
- `WorkEngagement`
- `ShiftLog`
- `Payment`
- `Notification`
- `AIRecommendation`
- `FraudFlag`
- `Dispute`
- `AdminAction`
- `SessionLog`

These are defined in `prisma/schema.prisma`.

## First-Time Setup

When a teammate clones the project for the first time, they should do this:

1. Install dependencies

```bash
npm install
```

2. Create their local env file

If `.env` is missing, copy the values from `.env.example` and add the real database connection string.

3. Generate the Prisma client

```bash
npm run prisma:generate
```

4. Apply existing migrations to the database

```bash
npm run prisma:migrate:deploy
```

5. Start the backend

```bash
npm run dev
```

## When You Change The Schema

If you add, remove, or edit a table or field in `prisma/schema.prisma`, follow these steps.

### Step 1: Edit the schema

Open:

- `prisma/schema.prisma`

Make your changes there.

Examples:

- add a new table
- add a new column
- rename a field
- add a relation
- add an enum value

### Step 2: Create a migration

Run:

```bash
npx prisma migrate dev --name describe_your_change
```

Example:

```bash
npx prisma migrate dev --name add_application_table
```

What this does:

- compares your schema with the current database
- creates a new migration folder
- writes SQL inside it
- applies the change to the database
- updates the Prisma client

## What To Commit To Git

After a schema change, commit:

- `prisma/schema.prisma`
- the new folder inside `prisma/migrations/`
- any code changes that depend on the new schema

Do not commit:

- your private `.env`

## Team Rule

If you change the schema, you must also create the migration and commit it.

Do not only change `schema.prisma` and stop there.

Why:

Because other teammates need the migration files to update their database safely.

## When You Pull New Changes From The Team

If someone else changed the database schema and pushed a migration, do this after pulling:

```bash
npm install
npm run prisma:migrate:deploy
npm run prisma:generate
```

This makes your local setup match the latest project state.

## Fast Everyday Workflow

Here is the normal developer workflow:

1. Pull latest code
2. Run:

```bash
npm run prisma:migrate:deploy
npm run prisma:generate
```

3. Make your schema changes in `prisma/schema.prisma`
4. Run:

```bash
npx prisma migrate dev --name short_clear_name
```

5. Test your code
6. Commit the schema file and migration folder

## Useful Commands

### Generate Prisma client

```bash
npm run prisma:generate
```

Use this when:

- you pulled schema changes
- you changed the schema
- Prisma types seem outdated

### Create and apply a migration in development

```bash
npm run prisma:migrate:dev -- --name your_change_name
```

Example:

```bash
npm run prisma:migrate:dev -- --name add_employer_profile
```

### Apply already existing migrations

```bash
npm run prisma:migrate:deploy
```

Use this when:

- you just pulled from the team
- you are setting up the project for the first time
- you want your database to match the migration history

### Open Prisma Studio

```bash
npm run prisma:studio
```

This opens a visual interface to inspect the database.

It is very helpful for beginners.

## How To Know If The Database Is In Sync

Good signs:

- the app starts correctly
- Prisma client generates without errors
- migrations apply without errors
- queries work

Bad signs:

- Prisma says a table or column does not exist
- your code expects a field but the database does not have it
- you changed `schema.prisma` but forgot to create a migration

## Common Mistakes

### Mistake 1: Editing the schema without running a migration

Fix:

```bash
npx prisma migrate dev --name describe_the_change
```

### Mistake 2: Pulling new code but forgetting to apply migrations

Fix:

```bash
npm run prisma:migrate:deploy
npm run prisma:generate
```

### Mistake 3: Committing `.env`

Do not do this.

`.env` contains secrets.

Only commit `.env.example`.

### Mistake 4: Giving migrations bad names

Use short clear names like:

- `add_jobs_table`
- `add_worker_profile_fields`
- `create_applications_table`

Avoid names like:

- `stuff`
- `changes`
- `fix`

## Safe Team Habit

Whenever you finish a schema change, ask yourself:

1. Did I update `prisma/schema.prisma`?
2. Did I run `prisma migrate dev`?
3. Did a new migration folder appear in `prisma/migrations/`?
4. Did I test the app?
5. Did I commit the schema and migration?

If the answer to all of these is yes, you are in a good place.

## Recommended Rule For This Project

For this team, use this rule:

- development machine: `prisma migrate dev`
- shared/production environment: `prisma migrate deploy`

That keeps local work flexible and shared environments safe.
