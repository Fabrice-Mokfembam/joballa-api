# joballa — Files Module (Cloudinary Upload)

Full NestJS file upload integration using `cloudinary`, built for the
joballa platform. Sits at `src/modules/files/` inside the project structure.

---

## Installation

```bash
npm install cloudinary streamifier @nestjs/platform-express multer
npm install -D @types/multer @types/streamifier
```

---

## Environment Variables

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## File Structure

```
src/
├── modules/
│   └── files/
│       ├── files.module.ts              # NestJS module — import into AppModule
│       ├── files.constants.ts           # Folder paths, allowed MIME types, max sizes
│       ├── cloudinary.provider.ts       # Initialises Cloudinary v2 SDK + DI token
│       ├── controllers/
│       │   └── files.controller.ts      # REST endpoints
│       └── services/
│           └── files.service.ts         # All upload methods (6 types) + delete
└── common/
    ├── guards/
    │   ├── jwt-auth.guard.ts            # JWT auth guard (implemented by auth module)
    │   └── role-guard.ts                # Role-based access guard
    └── pipes/
        └── file-type-validation.pipe.ts # Validates MIME type & size before upload
```

---

## Authentication & Roles

All endpoints are protected by `JwtAuthGuard` and `RolesGuard` from
`src/common/guards/`. Guard order matters — JWT must run before Roles:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)  // JWT first, then Roles
```

Role assignments per endpoint:

| Endpoint            | Required Role          |
| ------------------- | ---------------------- |
| `profile-photo`     | `WORKER`               |
| `verification-doc`  | `WORKER`               |
| `resume`            | `WORKER`               |
| `portfolio`         | `WORKER`               |
| `employer-logo`     | `EMPLOYER`             |
| `job-attachment`    | `EMPLOYER`             |
| `DELETE /:publicId` | `ADMIN`, `SUPER_ADMIN` |

The authenticated user's ID is extracted from the JWT token via your `@CurrentUser()`
decorator — **not** from URL params. This prevents a user from passing another
user's ID in the URL.

---

## API Endpoints

All endpoints expect `multipart/form-data` with a field named `file`.
Base path: `/files`

| Method   | Endpoint                                      | Description                           | Accepted Types       | Max Size |
| -------- | --------------------------------------------- | ------------------------------------- | -------------------- | -------- |
| `POST`   | `/files/profile-photo`                        | Worker profile photo                  | JPEG, PNG, WEBP      | 5 MB     |
| `POST`   | `/files/verification-doc?docType=national_id` | National ID or business reg           | JPEG, PNG, WEBP, PDF | 10 MB    |
| `POST`   | `/files/employer-logo`                        | Company logo                          | JPEG, PNG, WEBP      | 2 MB     |
| `POST`   | `/files/job-attachment/:jobId`                | File attached to a job posting        | PDF                  | 10 MB    |
| `POST`   | `/files/portfolio`                            | Worker portfolio / supporting doc     | JPEG, PNG, WEBP, PDF | 10 MB    |
| `POST`   | `/files/resume`                               | CV upload for AI profile prefill      | PDF                  | 5 MB     |
| `DELETE` | `/files/:publicId?resourceType=image`         | Delete a file by Cloudinary public ID | —                    | —        |

---

## Successful Upload Response

```json
{
  "publicId": "joballa/profile-photos/worker_abc123",
  "secureUrl": "https://res.cloudinary.com/your_cloud/image/upload/joballa/profile-photos/worker_abc123.jpg",
  "format": "jpg",
  "bytes": 204800,
  "width": 400,
  "height": 400,
  "resourceType": "image"
}
```

Save `secureUrl` to the relevant database field (e.g. `WorkerProfile.profilePhoto`).

---

## Validation Error Responses

The `FileTypeValidationPipe` rejects bad requests before they reach the service:

```json
// Wrong file type
{ "statusCode": 400, "message": "Invalid file type: text/plain. Allowed types: image/jpeg, image/png, image/webp" }

// File too large
{ "statusCode": 400, "message": "File too large. Maximum allowed size is 5 MB" }

// No file attached
{ "statusCode": 400, "message": "No file provided" }
```

---

## Using FilesService in Other Modules

`FilesModule` exports `FilesService` so any feature module can inject it directly:

```typescript
// src/modules/worker-profiles/worker-profiles.module.ts
import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { WorkerProfilesService } from './services/worker-profiles.service';

@Module({
  imports: [FilesModule],
  providers: [WorkerProfilesService],
})
export class WorkerProfilesModule {}
```

```typescript
// src/modules/worker-profiles/services/worker-profiles.service.ts
import { Injectable } from '@nestjs/common';
import { FilesService } from '../files/services/files.service';

@Injectable()
export class WorkerProfilesService {
  constructor(private readonly filesService: FilesService) {}

  async updatePhoto(userId: string, file: Express.Multer.File) {
    const uploaded = await this.filesService.uploadProfilePhoto(file, userId);
    // persist uploaded.secureUrl to WorkerProfile in the DB via Prisma
    return uploaded;
  }
}
```

---

## Cloudinary Folder Structure

All joballa assets are organised under a single `joballa/` root in the
Cloudinary Media Library:

```
joballa/
├── profile-photos/       worker_<userId>              (overwrite: true)
├── verification-docs/    <docType>_<userId>_<ts>       (type: authenticated)
├── employer-logos/       logo_<employerId>             (overwrite: true)
├── job-attachments/      job_<jobId>_<ts>
├── portfolio-docs/       portfolio_<workerId>_<ts>
└── resume-uploads/       resume_<workerId>             (overwrite: true)
```

---

## Testing

See the testing steps below to verify the setup using Thunder Client (VS Code)
or Postman before wiring up a frontend.

1. Start the server: `npm run start:dev`
2. Send a `POST` to `/files/profile-photo/id` with `multipart/form-data`, field `file`, any `.jpg`
3. Confirm a `201` response with a `secureUrl`
4. Paste the `secureUrl` in your browser — the image should load
5. Open the [Cloudinary Media Library](https://console.cloudinary.com/media_library)
   and confirm the file appears under `joballa/profile-photos/`
6. Test a failure case — upload a `.txt` file and confirm a `400` response

---

## Notes

- Files are held in **memory** (`memoryStorage`) and streamed directly to
  Cloudinary. Do not switch to `diskStorage` on Render or Railway deployments.
- Verification documents use `type: 'authenticated'` — they have no public URL.
  Generate a signed URL server-side if you need to display them to Admins.
- Profile photos, employer logos, and resumes use `overwrite: true` — re-uploading
  replaces the existing file at the same `publicId` automatically.
- Cloudinary upload errors are wrapped in `new Error(error.message)` before
  rejection to satisfy the `@typescript-eslint/prefer-promise-reject-errors` rule
  and ensure error messages surface correctly in Sentry.
