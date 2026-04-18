# Media inventory (captured 2026-04-17)

All 28 URLs returned HTTP 200. Root (`/`) redirects `instasecure.ai` → `www.instasecure.ai` (301) then serves the homepage — content is identical to `/main`.

## YouTube embeds

Video IDs `Rm7i7jxfWvY` and `zNwS3NZvGcY` returned "Not Found" from the YouTube oEmbed API, indicating they are private or unlisted videos. Titles for `D3pmyxFWmC4` and `ujfjOpjG_zU` were confirmed via oEmbed.

| Page | Video ID | Title / context | Needs transcript? |
|---|---|---|---|
| / | none | — | — |
| /main | none | — | — |
| /about | none | — | — |
| /contact | none | — | — |
| /pricing | none | — | — |
| /howitworks | none | — | — |
| /news | none | — | — |
| /events | none | — | — |
| /conference | none | — | — |
| /instaaccess | none | — | — |
| /instaworkforce | none | — | — |
| /instaaccess-use-cases | none | — | — |
| /instaworkforce-use-cases | none | — | — |
| /credential-compromise | Rm7i7jxfWvY | "The Credential Compromise Problem" (page h1; oEmbed: private/unlisted video) | yes |
| /cloud-zero-day-attack-solution | none | — | — |
| /data-perimeter-on-aws | none | — | — |
| /close-compliance-gap | zNwS3NZvGcY | Landing page — compliance gap; oEmbed: private/unlisted video | yes |
| /fix-risks-before-pentest | zNwS3NZvGcY | Same embed as /close-compliance-gap | yes |
| /who-really-has-access | zNwS3NZvGcY | Same embed as /close-compliance-gap | yes |
| /stop-paying-for-cloud | zNwS3NZvGcY | Same embed as /close-compliance-gap | yes |
| /walk-into-your-next-user-access-audit | zNwS3NZvGcY | Same embed as /close-compliance-gap | yes |
| /blog | none | — | — |
| /blog/a-new-era-of-preventive-cloud-security-with-aws | none | — | — |
| /blog/instaworkforce-in-action-workforce-security-use-cases-and-demo-for-aws | D3pmyxFWmC4 | "InstaSecure Enhancing AWS Cloud Security with InstaWorkforce" (oEmbed confirmed) | yes |
| /blog/proactive-cloud-security-tackling-credential-theft-with-instasecure | ujfjOpjG_zU | "Proactive Cloud Security Tackling Credential Theft with InstaSecure" (oEmbed confirmed) | yes |
| /blog/understanding-cloud-security-controls | none | — | — |
| /blog/preventive-human-access | none | — | — |
| /blog/instaworkforce | none | — | — |

**Unique video IDs: 4**
- `Rm7i7jxfWvY` — credential-compromise (private/unlisted)
- `zNwS3NZvGcY` — 5 landing pages: close-compliance-gap, fix-risks-before-pentest, who-really-has-access, stop-paying-for-cloud, walk-into-your-next-user-access-audit (private/unlisted)
- `D3pmyxFWmC4` — blog/instaworkforce-in-action (public)
- `ujfjOpjG_zU` — blog/proactive-cloud-security (public)

## External images / CDN references

All product images are served from Squarespace's own CDN (`images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/`). Representative hero and feature images are listed below. No third-party image CDNs detected.

| Page | URL | Notes |
|---|---|---|
| / | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/home-rotate1.2.gif` | Hero animated GIF |
| / | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/b8077971-0030-48b3-8175-d9e18beeec3c/platform2.png` | Platform diagram |
| / | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/1758573022823-UK51V9ALFD5WP46MXK8C/aws-banner2%402x.png` | AWS partnership banner |
| / | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/2b56dd30-623d-4076-b265-5fb8a0ec3128/Partner-Badge%403x.png` | AWS Partner badge |
| / | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/5ebcef87-b391-425f-b351-dc8a4887ebe4/AvailableInMarketplace_White_RGB.png` | AWS Marketplace badge (appears on many pages) |
| / | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/badfe83e-9d74-4fa8-9866-202745ff44a1/QS-badge%403x.png` | QuickStart badge |
| /instaaccess | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/40ddd88a-9f20-43fc-a893-b67430d9f54a/InstaAccess-hero.png` | InstaAccess hero image |
| /instaworkforce | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/153741ed-dcaa-462c-b5cc-d2d4cd3caecb/InstaWorkforce-ft07.png` | InstaWorkforce feature image |
| /close-compliance-gap | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/1fc0bc0d-3b33-43d7-b811-0de0c599fd1b/LandingAd01.png` | Landing page hero |
| / (social OG) | `https://images.squarespace-cdn.com/content/v1/66272c93ced316215a563dca/4619129c-40b6-48f5-8237-798c516a8102/Social-logo.png` | OG / social share logo |
| /blog/preventive-human-access | external GitHub reference | `github.com/aws-samples` linked in blog body |

## Social / external links discovered

| Kind | URL | Source page |
|---|---|---|
| AWS Marketplace listing | `https://aws.amazon.com/marketplace/pp/prodview-kmlldyula7axs` | / (and all pages — sitewide nav/footer) |
| AWS Marketplace seller profile | `https://aws.amazon.com/marketplace/seller-profile?id=4a6c459c-f656-480a-812c-eab216c22824` | / and /who-really-has-access |
| LinkedIn (individual — CEO/founder) | `https://www.linkedin.com/in/skuruvadi/` | /about |
| LinkedIn (individual — team) | `https://www.linkedin.com/in/kinnairdmcquade/` | /about |
| LinkedIn (individual — team) | `https://www.linkedin.com/in/nagesh-gummadivalli-5662401/` | /about |
| LinkedIn (individual — team) | `https://www.linkedin.com/in/jcfarris/` | /about |
| LinkedIn (company page) | not found | Site HTML contains only LinkedIn Insight Tag tracking pixel (`linkedin.com/collect/?pid=8141832`), not a company profile link |
| X / Twitter | not found | Meta tags use `twitter:card` schema only; no handle or profile URL in HTML |
| GitHub | `https://github.com/aws-samples` | /blog/preventive-human-access (AWS-owned, referenced in blog content — not InstaSecure's org) |
| GitHub (InstaSecure org) | not found | — |
| YouTube channel | not found | Only individual video embeds found; no channel URL in HTML |
| Security contact (mailto:) | not found | No `mailto:` links on any page; contact form uses Squarespace form submission; `user@domain.com` placeholder found in form HTML (not a real address) |
| Security contact (security@) | not found | No security contact email discoverable in HTML; no `/.well-known/security.txt` |
| General contact email | not found | All contact interactions route through Squarespace embedded form on /contact; no email address exposed in HTML |
| Facebook App ID | `314192535267336` | Squarespace context (internal tracking only, not a public page link) |
