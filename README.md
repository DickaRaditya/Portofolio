# CyberSec Professional Portfolio

Vite + vanilla JavaScript portfolio using Firebase Authentication, Cloud Firestore, and Cloud Storage. The portfolio uses a warm-white palette with forest-green accents.

## Firebase setup

1. Create a Firebase project and register a Web app. Copy its Firebase configuration.
2. Enable **Authentication → Sign-in method → Email/Password**. Create the administrator in **Authentication → Users** and copy the user's **UID**. There is no public registration page; other authenticated users have no write privileges.
3. Create the default Cloud Firestore database in production mode.
4. In `firestore.rules`, replace only the value assigned to `adminUid`:

   ```text
   let adminUid = 'YOUR_ACTUAL_ADMIN_UID';
   ```

   This repository is already configured for the cybersecporto admin. If using another project, update the UID in both `firestore.rules` and `storage.rules`. Leave the placeholder comparison unchanged. Rules do not read Vite environment variables.
5. Publish `firestore.rules` in **Firestore Database → Rules**, or use the Firebase CLI:

   ```sh
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

6. Copy `.env.example` to `.env.local` and fill in the four Firebase web configuration fields and `VITE_FIREBASE_ADMIN_UID`. The UID must match the rules. These are browser configuration values; never put service-account credentials or the admin password in a `VITE_*` variable.
7. Check **Authentication → Settings → Authorized domains** and add the production/custom domain and `localhost` for local development as needed.
8. Stay on the Spark plan for link-only records: paste a project URL or certificate verification/document URL in the dashboard. Keep `VITE_FIREBASE_ENABLE_STORAGE=false` (or omit it); the file picker is hidden. Cloud Storage attachments require Blaze; setup is documented in [STORAGE_SETUP.md](STORAGE_SETUP.md) if you enable it later.

## Local development

Use Node.js 22.12+ (Node.js 24 is also supported).

```sh
npm install
npm run dev
```

Open `/#login` to sign in. The dashboard supports editing the profile, adding/editing/deleting projects, and adding/editing/deleting certificates. On Spark, use the **Project URL** and **Verification URL** fields for public links; the file picker is hidden. Certificates require a link. If you later enable Storage on Blaze and set `VITE_FIREBASE_ENABLE_STORAGE=true`, projects and certificates can accept up to five optional attachments (10 MB each).

With no Firebase configuration, the public design remains visible with placeholder content and a setup notice; sign-in is disabled. Configuration is embedded at build time, so restart Vite or redeploy after changing environment variables.

## Firestore data

| Path | Fields |
| --- | --- |
| `profile/main` | `full_name`, `headline`, `bio`, `about`, `location`, `email`, `github`, `linkedin`, `published`, `updated_at` |
| `projects/{autoId}` | `title`, `category`, `description`, `url`, `sort_order` (integer), `published`, `attachments`, `attachment_paths`, `created_at`, `updated_at` |
| `certificates/{autoId}` | `title`, `description`, `kind`, `issuer`, `public_url`, `published`, `attachments`, `attachment_paths`, `created_at`, `updated_at` |

Dates are Firestore timestamps; publication flags are booleans. Saving the profile creates `profile/main` if needed. The app creates other documents automatically. No seed data or composite indexes are required. Public reads query only `published == true`; the admin dashboard reads drafts as well. Sorting is performed in the client.

Only the configured UID can write these collections. Unknown collections and nested paths are denied. Changing the browser UID variable cannot grant database access: deployed rules are the authority. See Firebase's [query/rules documentation](https://firebase.google.com/docs/firestore/security/rules-query) and [authentication documentation](https://firebase.google.com/docs/auth/web/start).

Each attachment contains `path`, `name`, `size` (bytes), and `type` (MIME type). `attachment_paths` mirrors those paths for Storage rule checks. Binary files live under `portfolio/{projects|certificates}/{documentId}/{uploadId}/{filename}` in Cloud Storage. Public downloads require a published Firestore document that still references the file. The app uses rule-checked blob downloads rather than storing token download URLs. Downloads already saved by a visitor and external public URLs cannot be revoked by unpublishing.

File replacements use new paths. Metadata is saved before removed files are deleted; failed saves clean up new uploads, and failed cleanup is reported to the admin. Unreferenced objects are not publicly readable through the rules. Existing link-only records remain compatible; no data migration is needed.

## Vercel deployment

1. Import this repository in Vercel and select Node.js 24.x (or 22.x).
2. Add all variables from `.env.example` in **Project Settings → Environment Variables** for the relevant environments.
3. Configure the admin UID and publish Firestore rules before using the dashboard.
4. Deploy. `vercel.json` sets the Vite framework, `npm ci` installation, `npm run build`, `dist` output directory, and SPA fallback.
5. Add the Vercel/custom domain to Firebase Authentication's authorized domains as needed. Environment changes require a fresh deployment.

Vercel hosts the frontend only; deploying it does not deploy Firestore or Storage rules or configure bucket CORS. Firebase credentials/account setup and data population must be completed in your own project. A Spark deployment does not need Storage setup when every record uses external links.

## Verification

```sh
npm test
npm run build
npm run preview
```

The automated tests cover public filtering, admin checks, CRUD, attachment validation, upload progress, failed-upload/save cleanup, and deletion ordering. They mock the SDK and do not replace testing deployed Firestore and Storage rules.

Before going live, use the Firebase Rules Playground (or Firestore emulator with Java 21+) to verify:

- Anonymous and other authenticated users can read published records, cannot read drafts or run unrestricted collection queries, and cannot create/update/delete any content.
- The configured admin UID can read drafts and create/update/delete content in all three allowed paths. A non-boolean publication flag is rejected.
- A different UID and writes to unknown/nested collections are denied.

Then sign in as admin, edit the profile, exercise project/certificate CRUD and publication toggles, refresh `/#dashboard` to verify session restoration, and sign out. In a separate signed-out browser, confirm that only published content appears.

After Storage setup, also upload a PDF and ZIP, download published attachments while signed out, unpublish and confirm SDK downloads are denied, remove/replace attachments, and delete the parent record. Confirm non-admin writes and unsupported/oversized uploads fail in Storage Rules Playground or the emulators.
