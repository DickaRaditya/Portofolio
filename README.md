# CyberSec Professional Portfolio

Vite + vanilla JavaScript portfolio with Firebase Authentication/Firestore and private Cloudflare R2 attachments. Vercel hosts the frontend and the file authorization API. The design uses warm white and forest green.

## Setup

1. Register a Firebase Web app, enable Email/Password Authentication, and create the administrator account. There is no public registration.
2. Create the default Firestore database. Set the admin UID in `firestore.rules` and publish those rules. This repository already contains the cybersecporto admin UID; change it if using another account/project.
3. Copy `.env.example` to `.env.local`, filling the existing Firebase browser configuration and matching admin UID. Add local/production domains to Firebase Authentication's authorized domains.
4. Follow [STORAGE_SETUP.md](STORAGE_SETUP.md) to create the private R2 bucket, configure CORS and server credentials, and enable `VITE_R2_ENABLE_UPLOADS=true`.
5. Deploy to Vercel with the variables from `.env.example`. Server credentials must never use the `VITE_` prefix. Redeploy after environment changes.

Without R2 configuration, leave the upload flag false or unset: login, content editing, external links, and management of existing attachments remain available. Firebase Storage billing is not needed for new R2 uploads. Existing Firebase files retain their original service requirements until migrated.

## Development

Use Node.js 22.12+ (24.x recommended).

```sh
npm install
npm run dev:full
```

This starts Vite and `/api/files` at `http://127.0.0.1:5173`. `npm run dev` is frontend-only. Open `/#login` for the admin dashboard. With no Firebase browser configuration, placeholder public content remains visible and sign-in is disabled.

Projects and certificates support up to five attachments, 10 MB each: PDF, DOC, DOCX, XLSX, PPTX, PNG, JPG, WebP, TXT, MD, CSV, ZIP. Certificates require either an attachment or an external link. Resume remains an external URL in the profile editor.

## Data and file access

| Firestore path | Main fields |
| --- | --- |
| `profile/main` | `full_name`, `headline`, `bio`, `about`, `location`, `email`, `github`, `linkedin`, `resume_url`, `published`, `updated_at` |
| `projects/{id}` | `title`, `category`, `description`, `url`, `sort_order`, `published`, `attachments`, `attachment_paths`, `created_at`, `updated_at` |
| `certificates/{id}` | `title`, `description`, `kind`, `issuer`, `public_url`, `published`, `attachments`, `attachment_paths`, `created_at`, `updated_at` |

Each new attachment contains `provider: 'r2'`, `path`, `name`, `size`, and `type`. A missing provider (or `firebase`) denotes a legacy Firebase object. Both providers can coexist during migration. Paths follow `portfolio/{projects|certificates}/{recordId}/{uploadId}/{filename}`; no signed URLs are persisted.

The API verifies Firebase tokens, including revocation, and compares the UID against its own server setting. Only admin can request upload URLs or delete files. Downloads require a matching attachment on an existing published Firestore record, or the admin's authenticated request for an attached draft. R2 stays private. Download URLs expire after 60 seconds; previously issued URLs can work until expiry after unpublishing. Downloaded copies and external public URLs cannot be revoked.

Uploads go directly from the browser to R2 using a five-minute signature that binds object path, length, content type, and metadata. The server checks object size/type before issuing downloads. File-type validation is an allowlist, not malware scanning. Firestore metadata is saved before removed files are deleted; failed saves clean new uploads, and cleanup failures are reported. Interrupted browser sessions can leave private unreferenced objects for manual cleanup.

## Migrating existing attachments

See [the migration instructions](STORAGE_SETUP.md#8-migrasi-file-firebase-yang-sudah-ada). The default is a read-only inventory:

```sh
npm run migrate:files
npm run migrate:files -- --apply
```

Apply copies referenced Firebase files, verifies SHA-256 from R2, backs up metadata locally, and switches each record using a Firestore update precondition. It never deletes Firebase originals or changes external links. Unreferenced source objects are reported for separate review. If no Firebase files were previously uploaded, there is nothing to migrate.

## Verification and deployment

For the migration to `kotartos.my.id` while keeping the existing Vercel address active as a redirect, follow [DOMAIN_MIGRATION.md](DOMAIN_MIGRATION.md). The CORS JSON files include the new origins, but their policies must also be applied to the live buckets.

```sh
npm test
npm run build
```

Tests cover content permissions/CRUD, mixed storage providers, failed transfer/save cleanup, backend authorization, draft/removed-file denial, signed upload headers, migration verification, and conflicting destinations. They use mocks plus the real offline presigner and do not replace a live Firebase/R2 smoke test.

Vercel builds `dist` and deploys `api/files.js` as a Node function. The SPA fallback excludes `/api/`. Ensure Node.js 24.x or 22.12+, matching Firebase admin UID on client/server/rules, Firebase authorized domains, and exact R2 CORS origins. Publishing the frontend does not create the bucket, configure credentials/CORS, or deploy Firestore rules. Follow the live verification steps in STORAGE_SETUP.md before migrating production files.

Legacy `storage.rules` and `storage.cors.json` remain for unmigrated Firebase attachments. New R2 permissions are enforced by `server/files-handler.js` and private bucket credentials.
