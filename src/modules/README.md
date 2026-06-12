## Module Convention

Every business domain inside `src/modules` follows the same structure so new contributors always know where to look.

## Route files

The files that expose API routes belong in `controllers/`.

Example:

```text
src/modules/jobs/controllers/jobs.controller.ts
```

Controllers are the public HTTP entrypoints for the backend.

## Internal responsibilities

- `controllers/` define routes and hand requests to services
- `services/` contain use-case logic
- `dto/` define request and response payloads
- `entities/` define domain-facing data structures
- `repositories/` read and write data
- `policies/` enforce permissions and business rules

## Module files

Each module also contains:

- `<module>.module.ts` to register controllers and providers
- `<module>.constants.ts` for module-level constants

## Important boundary

Keep cross-cutting infrastructure in `src/common`, `src/config`, and `src/prisma`.

Do not:

- put business logic directly in controllers
- call Prisma directly from controllers
- mix unrelated business domains into one module
