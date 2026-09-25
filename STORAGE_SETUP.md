# Enable project and certificate uploads

The frontend supports multiple attachments behind `VITE_FIREBASE_ENABLE_STORAGE=true`, but the Firebase bucket must be enabled separately. If you stay on Spark, leave that variable false or unset: the file picker is hidden, and you should use the dashboard's Project URL and Verification URL fields instead. Existing links and the rest of the portfolio continue to work without Storage.

## 1. Enable Firebase Storage

In the **cybersecporto** Firebase project, open **Databases & Storage → Storage → Get started**. Firebase requires the **Blaze billing plan** for Cloud Storage. Review and enable billing yourself, then provision the default bucket. This code change does not enable billing or create a bucket.

Expected bucket: `cybersecporto.firebasestorage.app`. The app uses that default automatically. If the actual bucket has a different name, set `VITE_FIREBASE_STORAGE_BUCKET` in `.env.local` and in Vercel, then restart/redeploy. Use the bucket name without `gs://`.

Reference: [Firebase Storage setup](https://firebase.google.com/docs/storage/web/start).

## 2. Publish Storage rules

Open the **complete** `storage.rules` file (not a code diff), copy it into **Storage → Rules**, and click **Publish**. These are separate from the existing Firestore rules.

The admin UID is already set. Public file reads require a published parent record and a matching entry in its `attachment_paths`. Other users cannot upload, overwrite, or delete files. Only supported file types up to 10 MB are accepted. Unmatched paths and listing are denied.

Firebase may prompt you to enable the connection between Storage rules and Firestore. This is needed because the rules check a record's publication status. Follow the console's enablement prompt for this project.

Alternatively, from a signed-in Firebase CLI:

```sh
npx firebase-tools deploy --only storage --project cybersecporto
```

Reference: [Storage rules using Firestore](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_firestore).

## 3. Allow browser downloads with CORS

The app downloads through the Storage SDK so every download checks the rules. Firebase requires bucket CORS configuration for browser `getBlob` downloads.

With Google Cloud CLI installed and signed in as the bucket owner, run from this project folder:

```sh
gcloud storage buckets update gs://cybersecporto.firebasestorage.app --cors-file=storage.cors.json
```

`storage.cors.json` includes the production domain `https://portofolio-theta-ten-80.vercel.app` and local development/preview origins. Add any custom domain or exact Vercel preview URL you want to test, and reapply the command. CORS does not grant access to unpublished files; Storage rules still enforce authorization.

Reference: [Firebase browser downloads and CORS](https://firebase.google.com/docs/storage/web/download-files#cors_configuration).

## 4. Verify

1. Sign in to the portfolio dashboard.
2. Create a project or certificate, select files under **Attachments**, and save. You can upload up to five files per record, 10 MB each.
3. Confirm a published file downloads in a signed-out browser.
4. Unpublish the item and confirm it disappears publicly.
5. Edit it, mark an attachment **Remove on save**, and save. Deleting an entire item also cleans up its attachments.

Supported formats: PDF, PNG, JPG, WebP, TXT, MD, CSV, ZIP, DOCX, PPTX, XLSX. Replacing a file means removing the old one and choosing the new file before saving. Existing external links remain available.

If upload/download fails, check billing/bucket provisioning, Storage rules, the Firestore integration prompt, bucket name, and CORS. A successful frontend deployment alone does not configure these services.
