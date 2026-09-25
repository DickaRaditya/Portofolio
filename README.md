# CyberSec Professional Portfolio

Vite + vanilla JavaScript portfolio using Firebase Authentication and Cloud Firestore. The existing dark green portfolio layout is preserved.

## Firebase setup

1. Create a Firebase project and register a Web app. Copy its Firebase configuration.
2. Enable **Authentication → Sign-in method → Email/Password**. Create the administrator in **Authentication → Users** and copy the user's **UID**. There is no public registration page; other authenticated users have no write privileges.
3. Create the default Cloud Firestore database in production mode.
4. In `firestore.rules`, replace only the value assigned to `adminUid`:

   ```text
   let adminUid = 'YOUR_ACTUAL_ADMIN_UID';
   ```

   Leave the placeholder comparison on the following line unchanged. The unchanged rules intentionally deny all writes until configured. Rules do not read Vite environment variables.
5. Publish `firestore.rules` in **Firestore Database → Rules**, or use the Firebase CLI:

   ```sh
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

6. Copy `.env.example` to `.env.local` and fill in the four Firebase web configuration fields and `VITE_FIREBASE_ADMIN_UID`. The UID must match the rules. These are browser configuration values; never put service-account credentials or the admin password in a `VITE_*` variable.
7. Check **Authentication → Settings → Authorized domains** and add the production/custom domain and `localhost` for local development as needed.

## Local development

Use Node.js 22.12+ (Node.js 24 is also supported).

```sh
npm install
npm run dev
```

Open `/#login` to sign in. The dashboard supports editing the profile, adding/editing/deleting projects, and adding/editing/deleting certificates. Each has a **Published** checkbox. Clearing it hides that record from public readers. **Cancel / New** clears an edit form to create a new record.

With no Firebase configuration, the public design remains visible with placeholder content and a setup notice; sign-in is disabled. Configuration is embedded at build time, so restart Vite or redeploy after changing environment variables.

## Firestore data

| Path | Fields |
| --- | --- |
| `profile/main` | `full_name`, `headline`, `bio`, `about`, `location`, `email`, `github`, `linkedin`, `published`, `updated_at` |
| `projects/{autoId}` | `title`, `category`, `description`, `url`, `sort_order` (integer), `published`, `created_at`, `updated_at` |
| `certificates/{autoId}` | `title`, `description`, `kind`, `issuer`, `public_url`, `published`, `created_at`, `updated_at` |

Dates are Firestore timestamps; publication flags are booleans. Saving the profile creates `profile/main` if needed. The app creates other documents automatically. No seed data or composite indexes are required. Public reads query only `published == true`; the admin dashboard reads drafts as well. Sorting is performed in the client.

Only the configured UID can write these collections. Unknown collections and nested paths are denied. Changing the browser UID variable cannot grant database access: deployed rules are the authority. See Firebase's [query/rules documentation](https://firebase.google.com/docs/firestore/security/rules-query) and [authentication documentation](https://firebase.google.com/docs/auth/web/start).

Certificate records contain links to issuer verification pages or documents hosted elsewhere. Binary upload/storage is not part of this Firestore implementation. Unpublishing hides the record, but does not revoke access to an externally hosted public URL. Existing database records and uploaded assets are not automatically transferred: re-enter/import records with the fields above and replace old document URLs with their new hosted URLs before retiring the previous backend.

## Vercel deployment

1. Import this repository in Vercel and select Node.js 24.x (or 22.x).
2. Add all variables from `.env.example` in **Project Settings → Environment Variables** for the relevant environments.
3. Configure the admin UID and publish Firestore rules before using the dashboard.
4. Deploy. `vercel.json` sets the Vite framework, `npm ci` installation, `npm run build`, `dist` output directory, and SPA fallback.
5. Add the Vercel/custom domain to Firebase Authentication's authorized domains as needed. Environment changes require a fresh deployment.

Vercel hosts the frontend only; deploying it does not deploy Firestore rules. Firebase credentials/account setup and data population must be completed in your own project.

## Verification

```sh
npm test
npm run build
npm run preview
```

The automated data-layer tests cover public query filtering, rejection of non-admin mutations, and create/update/delete behavior. They mock the SDK and do not replace testing deployed Firestore rules.

Before going live, use the Firebase Rules Playground (or Firestore emulator with Java 21+) to verify:

- Anonymous and other authenticated users can read published records, cannot read drafts or run unrestricted collection queries, and cannot create/update/delete any content.
- The configured admin UID can read drafts and create/update/delete content in all three allowed paths. A non-boolean publication flag is rejected.
- A different UID and writes to unknown/nested collections are denied.

Then sign in as admin, edit the profile, exercise project/certificate CRUD and publication toggles, refresh `/#dashboard` to verify session restoration, and sign out. In a separate signed-out browser, confirm that only published content appears.
