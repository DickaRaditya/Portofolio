# Domain migration to kotartos.my.id

Target: `https://kotartos.my.id`

Existing address: `https://portofolio-theta-ten-80.vercel.app`

Hosting stays on the existing Vercel project. DewaBiz manages the purchased domain. Keep the old Vercel domain attached so it can redirect visitors. Firebase data, accounts, and private R2 objects stay in their existing services.

## 1. Attach the new domain

In the existing Vercel project, open **Settings → Domains → Add Domain**, add `kotartos.my.id`, and connect it to **Production**. Optionally add `www.kotartos.my.id` with a redirect to the apex domain. Do not redirect the old domain yet.

Copy the exact DNS records Vercel displays for this project. Do not substitute an IP address or CNAME target from an unrelated tutorial.

## 2. Configure DewaBiz DNS

Open the [DewaBiz client area](https://my.dewabiz.com/), select **Domain → My Domains → kotartos.my.id → DNS Management**. Confirm that the domain's authoritative nameservers serve the DNS zone being edited; DewaBiz has different DNS products, so use the nameservers shown for the active DNS service.

| Name | Type | Value |
| --- | --- | --- |
| `@` (or the apex name required by the panel) | A | `216.198.79.1` |
| `www` (if added in Vercel) | CNAME | `5f84ffeedae58a68.vercel-dns-017.com` |
| As shown by Vercel, if ownership verification is requested | TXT | Exact verification value shown by Vercel |

The A and CNAME values above were read from this project's Vercel domain settings on September 28, 2026. Check the live dashboard again if configuring them later.

Replace conflicting web records at these names as needed, preserving unrelated records, especially MX and email TXT records. Use DNS pointing, not DewaBiz URL forwarding to the old website. A redirect from the new domain back to the old one would loop once the old address redirects to the new one.

Wait until Vercel reports valid configuration and HTTPS works on the new address before proceeding with the old-domain redirect.

## 3. Allow the new browser origin

- Firebase Console → Authentication → Settings → Authorized domains: add `kotartos.my.id`. Add `www.kotartos.my.id` if serving the app there. Keep existing entries. Keep the existing `VITE_FIREBASE_AUTH_DOMAIN` unless separately configuring a custom Firebase auth handler.
- Cloudflare R2 → existing private bucket → Settings → CORS policy: merge the new origins from `r2.cors.json` into the live policy. Preserve any additional live origins/settings. Saving this repository file or deploying to Vercel does not update R2 CORS.
- If Firebase Storage attachments remain in use, merge the origins from `storage.cors.json` into that bucket's live CORS policy as well.
- If the Firebase API key has HTTP referrer restrictions, include the new site. Check domain restrictions for App Check if it is enabled.

## 4. Verify the new domain

1. Visit `https://kotartos.my.id` and confirm the expected published profile, projects, and certificates load.
2. Open `https://kotartos.my.id/#login` and sign in. Browser sessions are scoped to the origin, so signing in again on the new domain is expected.
3. Check attachment previews and downloads, then upload a small test attachment to a draft record and remove it after verifying success.
4. Confirm `/api/files` reaches the API rather than returning the SPA HTML page.

## 5. Redirect the old domain after verification

This repository now configures permanent 308 redirects in `vercel.json` for both `portofolio-theta-ten-80.vercel.app` and `www.kotartos.my.id` to `https://kotartos.my.id`, preserving the path. Keep all three domains attached to Production in Vercel. The apex domain does not match either redirect, preventing a loop. `index.html` declares the new apex as the canonical URL.

The old-domain rule is:

```json
"redirects": [
  {
    "source": "/:path*",
    "has": [{ "type": "host", "value": "portofolio-theta-ten-80.vercel.app" }],
    "destination": "https://kotartos.my.id/:path*",
    "permanent": true
  }
]
```

No separate dashboard redirect is required. Do not create an unconditional redirect, which would also match the new domain.

Verify the old root and a URL with a path/query redirect to the corresponding new URL. Check `/#projects` and `/#login` in a browser, since URL fragments are handled by the browser and are not sent to the server. Check that the new domain itself does not redirect in a loop.

## Recovery

If a problem appears, remove the relevant rule from `vercel.json` and redeploy. Existing old-domain CORS permissions remain available. A permanent redirect may remain cached in browsers. Firebase Authorized Domains governs OAuth and phone sign-in; this app currently uses email/password sign-in.

## Migration progress (September 29, 2026)

- DewaBiz free DNS management enabled and the A/CNAME records above saved.
- Vercel confirms valid configuration for the apex, www, and old Vercel domain; all remain attached to Production.
- New apex loads the published portfolio over HTTPS.
- Firebase Authorized Domains includes both new domains.
- Live private R2 CORS policy includes both new HTTPS origins, retaining its previous origins, methods, and headers. Public bucket access remains disabled.
- Redirect rules and canonical URL prepared for deployment; production redirect verification follows the deployment.

## References

- [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel domain redirects](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting)
- [DewaBiz DNS management](https://dewabiz.com/blog/panduan-lengkap-pengaturan-dns-domain-di-dewabiz)
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
