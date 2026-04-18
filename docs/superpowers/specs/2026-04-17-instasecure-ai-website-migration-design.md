# InstaSecure.ai Website Migration — Design Spec

**Date:** 2026-04-17
**Status:** Draft — awaiting review

## Background & Goal

Migrate the marketing/content website at `instasecure.ai` from Squarespace to a code-based stack hosted on Vercel, stored in a GitHub repo (`instasecure-ai-website`). The goal is faster iteration on website changes — editing code (with AI assistance) rather than clicking through the Squarespace editor.

The InstaSecure product UI lives on a separate domain, so `instasecure.ai` is purely a marketing/content site. This is not a product migration.

## Scope

### In scope
- Full static rebuild of all 28 content pages currently live on `instasecure.ai`
- Migration of 6 blog posts into MDX
- Preservation of all current URL paths (no SEO-affecting URL changes)
- Demo and contact forms delivering submissions to email
- Replication of whatever analytics is currently installed on the Squarespace site
- DNS cutover to Vercel

### Out of scope (YAGNI)
- No CMS — MDX files are sufficient for a small blog
- No i18n
- No A/B testing infrastructure
- No auth / user accounts (product lives on a separate domain)
- No test framework beyond Astro's build-time checks and manual QA
- No design-system refactor beyond what the migration naturally produces
- Canceling the Squarespace subscription (user does this separately once the cutover is stable)

## Tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Astro (v5.x) | Purpose-built for content/marketing sites; zero-JS-by-default ships static HTML (critical for AI/LLM crawlers that don't execute JS); first-class MDX + content collections; React-island escape hatch if interactivity needed later |
| Styling | Tailwind CSS | Fast iteration, token-driven, canonical Astro pairing |
| Language | TypeScript | Type-safe content collections; fewer runtime surprises |
| Blog content | Astro Content Collections + MDX | Type-checked frontmatter; markdown with component escape hatch |
| Forms | Formspree (initial) | 10-minute setup; free tier; email forwarding. Swappable for Vercel serverless + Resend later without changing form UI |
| Hosting | Vercel | Auto-deploy on `main`; preview deploys on PRs; native Astro support |
| Repo | `instasecure-ai-website` — private GitHub repo | |
| Analytics | Detect the current Squarespace analytics tag during phase 6 and replicate it (if it's a portable provider like GA4); if the current setup is Squarespace-only, install GA4 as the replacement | Continuity over novelty — don't break any dashboards the user relies on |
| Package manager | npm | Default; locked for this implementation |
| Node | 20 LTS | |

## Site inventory

### Marketing / core (8 pages)
- `/` (home — content currently served from `/main` in Squarespace's sitemap)
- `/about`
- `/contact`
- `/pricing`
- `/howitworks`
- `/news`
- `/events`
- `/conference`

### Products (4 pages)
- `/instaaccess`
- `/instaworkforce`
- `/instaaccess-use-cases`
- `/instaworkforce-use-cases`

### Use-case / solution landing pages (8 pages)
- `/credential-compromise`
- `/cloud-zero-day-attack-solution`
- `/data-perimeter-on-aws`
- `/close-compliance-gap`
- `/fix-risks-before-pentest`
- `/who-really-has-access`
- `/stop-paying-for-cloud`
- `/walk-into-your-next-user-access-audit`

### Blog (7 routes)
- `/blog` (index)
- Six post routes, preserving existing slugs:
  - `/blog/a-new-era-of-preventive-cloud-security-with-aws`
  - `/blog/instaworkforce-in-action-workforce-security-use-cases-and-demo-for-aws`
  - `/blog/proactive-cloud-security-tackling-credential-theft-with-instasecure`
  - `/blog/understanding-cloud-security-controls`
  - `/blog/preventive-human-access`
  - `/blog/instaworkforce`

### Utility
- `/404` (custom 404 page)

### URL decisions
- Preserve all existing flat URLs unchanged. No regrouping into `/products/...` or `/use-cases/...`. Rationale: inbound-link preservation, SEO equity, existing email/campaign links keep working with zero redirects.
- `/main` → `/` (301 redirect, configured in `vercel.json`) — removes the one Squarespace quirk in the sitemap.

## Architecture

### Repository structure

```
instasecure-ai-website/
├── public/                    # favicon, robots.txt, static assets served as-is
├── src/
│   ├── assets/                # images Astro optimizes (logo, product screenshots, hero illustrations)
│   ├── components/
│   │   ├── layout/            # Nav, Footer, BaseHead
│   │   ├── ui/                # Button, Card, Badge, Icon
│   │   ├── sections/          # Hero, FeatureGrid, PricingTable, CTAStripe, Testimonial
│   │   └── forms/             # DemoForm, ContactForm
│   ├── content/
│   │   ├── blog/              # MDX posts
│   │   └── config.ts          # content collection schema
│   ├── data/                  # nav.ts, footer.ts, pricing.ts — structured data in one place
│   ├── layouts/               # BaseLayout, UseCaseLayout, BlogPostLayout
│   ├── pages/                 # routes — mirror the URL table 1:1
│   ├── styles/                # global.css, theme.css (brand tokens)
│   └── lib/                   # small utilities (date formatting, slugs)
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── vercel.json                # redirects (e.g., /main → /)
└── package.json
```

### Components

- **Layouts**
  - `BaseLayout.astro` — HTML shell, `<head>` (meta, analytics), global `Nav` and `Footer`.
  - `UseCaseLayout.astro` — slotted template for the 8 use-case pages (problem → impact → solution → CTA). Lets each use-case page file stay ~15 lines of content.
  - `BlogPostLayout.astro` — blog-post chrome: hero image, title, date, author, rendered MDX body.
- **Section components** (reusable marketing primitives): `Hero`, `FeatureGrid`, `PricingTable`, `CTAStripe`, `Testimonial`, etc. Pages compose these.
- **UI primitives**: `Button`, `Card`, `Badge`, `Icon`.
- **Forms**: `DemoForm`, `ContactForm` — both POST to Formspree.

### Content model

- **Marketing pages**: copy lives inline in the `.astro` page file. Lowest-friction editing — when you want to change copy, you find the text in the file you're looking at.
- **Blog posts**: MDX under `src/content/blog/<slug>.mdx`. Frontmatter: `title`, `description`, `publishDate`, `author`, `heroImage`, `tags`. Schema enforced by `src/content/config.ts`.
- **Structured data** (nav items, footer links, pricing tiers): TypeScript files under `src/data/`. One source of truth, type-checked.
- **Images**: downloaded from Squarespace's CDN into the repo.
  - Page-level images → `src/assets/` — Astro's `<Image>` auto-optimizes to WebP/AVIF with responsive sizes.
  - Favicons, `robots.txt` → `public/`.
- **Video embeds (YouTube)**: one reusable `<Video>` Astro component at `src/components/ui/Video.astro`, used identically in `.astro` marketing pages and MDX blog posts. It:
  - Renders a **facade embed** via `astro-embed`'s `YouTube` component (or `lite-youtube-embed`) — lightweight thumbnail + play button, loads the real iframe only on click. Cuts video embed weight from ~1–2 MB to ~3 KB until interaction.
  - Uses the `youtube-nocookie.com` host for privacy.
  - Emits `VideoObject` JSON-LD from its props (`id`, `title`, `description`, `uploadDate`, `duration`).
  - Renders a `<details>` "Show transcript" block pulling from `src/data/transcripts/<video-id>.txt` (transcript committed once per video).

### Forms — data flow

User submits `DemoForm` or `ContactForm` → `POST` to Formspree endpoint (form ID read from env var `FORMSPREE_FORM_ID`) → Formspree emails configured recipients → user sees success state. Error states handled client-side. No server-side code for forms in the initial build.

Later migration path (not needed day-one): replace Formspree POST target with an Astro API route that uses Resend to send the email, giving full control over templating and no third-party dependency.

## Migration plan (phased)

All phases happen on a Vercel preview URL. `main` auto-deploys to that URL. Nothing touches `instasecure.ai` until Phase 7.

| Phase | Scope | Outcome |
|---|---|---|
| 0. Setup | Create `instasecure-ai-website` repo on GitHub, scaffold Astro + Tailwind + TypeScript, connect Vercel, implement `BaseLayout` / `Nav` / `Footer`, extract brand tokens (colors, fonts) from the live site into `theme.css`, **capture Playwright visual baseline of current Squarespace site** | Blank preview URL live; design foundation exists; pre-migration visual record in `tests/visual/baseline/` |
| 1. Homepage | Rebuild `/` end-to-end — hero, feature sections, CTAs, product teasers | Design system locked in; establishes the pattern every other page follows |
| 2. Core pages | `/about`, `/contact` (with `ContactForm`), `/pricing`, `/howitworks`, `/instaaccess`, `/instaworkforce` | Primary buying-journey pages live |
| 3. Use-case pages | Build `UseCaseLayout`; port all 10 (`/instaaccess-use-cases`, `/instaworkforce-use-cases`, and the 8 solution pages) | All solution landing pages live |
| 4. Remaining | `/events`, `/conference`, `/news`, `/404` | Long-tail pages done |
| 5. Blog | Content collection schema, 6 MDX posts, `/blog` and `/blog/[slug]` routes | Blog fully functional |
| 6. Polish, SEO, AI, performance & authority | Implement everything in "SEO, discoverability & redirects", "AI / LLM crawlability", "Performance, security & quality", and "Authority & E-E-A-T signals" sections. Lighthouse pass, Rich Results validation, securityheaders.com A+ grade, CI link-check green, **Playwright visual diff against baseline — review all drift and classify**, full manual QA on all 28 pages. | Production-ready on preview URL |
| 7. Cutover | Lower DNS TTL 24h ahead; repoint `instasecure.ai` DNS to Vercel; Vercel auto-issues SSL; monitor 24–48h | Live on new stack |

### Per-page migration procedure (phases 1–4)

1. Fetch the live page. Extract: `<title>`, meta description, OG image URL, body copy, structured sections, inline image URLs, and any embedded YouTube video IDs + surrounding context.
2. Download images into `src/assets/`. For each embedded YouTube video, fetch its transcript: `yt-dlp --write-auto-sub --skip-download --sub-lang en <url>`, strip timestamps, commit to `src/data/transcripts/<video-id>.txt`.
3. Build the `.astro` page by composing section components; paste copy inline. Each video is rendered via the `<Video>` component with YouTube ID + metadata props.
4. Verify visually on the Vercel preview; confirm the video facade loads fast and the transcript renders.

### Blog post migration procedure (phase 5)

1. Fetch each post.
2. Convert HTML body to Markdown/MDX (preserve headings, lists, links, code blocks, images, and YouTube embeds — embeds become `<Video>` component calls in MDX).
3. Extract frontmatter: title, publish date, description, hero image, author, tags.
4. Save to `src/content/blog/<existing-slug>.mdx`. For each embedded video, fetch its transcript via `yt-dlp` and commit to `src/data/transcripts/<video-id>.txt`.
5. Verify rendered output matches original on preview.

## SEO, discoverability & redirects

### Meta & canonical basics
- Per-page `<title>`, `<meta description>`, Open Graph, and Twitter card.
- Canonical URLs set.
- No existing URL paths will change.

### Social sharing cards (Open Graph / Reddit / LinkedIn / Slack / Discord / X)

Reddit, LinkedIn, Slack, Discord, WhatsApp, Facebook, iMessage all read Open Graph tags; X layers Twitter Card tags on top. The quality of every share is dictated by these tags and the OG image.

**Per-page OG images — auto-generated:**
- Use `astro-og-canvas` (preferred; build-time, no runtime cost) or `@vercel/og` (edge function, runtime) to generate a unique `og:image` per page.
- Template: InstaSecure logo + page title + subtle brand gradient. Blog-post variant: + author name + publish date.
- Fallback: static `/og-default.png` for any page without a specific override.

**Image spec (all OG images):**
- **1200 × 630 PNG** — universally compatible. Reddit and LinkedIn historically have problems with WebP and SVG in OG contexts, so PNG is the safe choice.
- Absolute HTTPS URL in `og:image` (relative URLs silently break on some scrapers).
- Target file size under 500 KB.

**Required tags per page:**
- `og:title`, `og:description`, `og:image`, `og:image:width=1200`, `og:image:height=630`, `og:url`, `og:type`, `og:site_name=InstaSecure`, `og:locale=en_US`.
- Twitter: `twitter:card=summary_large_image`, `twitter:site=@<company-handle>` (if InstaSecure has an X handle), `twitter:creator=@<author-handle>` on blog posts.
- Blog posts additionally: `article:author`, `article:published_time`, `article:modified_time`, `article:tag`.
- `<meta name="theme-color">` — renders as the embed accent bar on Discord and the browser chrome color on Chrome Android.

**Content quality for sharing:**
- Titles: 50–60 characters (longer gets truncated on Reddit / LinkedIn / X).
- Descriptions: 150–160 characters (same reason).
- No stock photos in OG images — distinctive, branded treatments stand out in crowded feeds.

**Validation gates (pre-cutover):**
- **Facebook Sharing Debugger** — covers Facebook, Instagram, WhatsApp, iMessage in one shot.
- **LinkedIn Post Inspector** — LinkedIn caches aggressively, so validating via Inspector also refreshes its cache.
- **X / Twitter Card Validator**.
- **Manual paste in Slack and Discord** — both render previews instantly, no validator needed.
- **Reddit** — submit test posts to `r/test` (or similar sandbox) to verify how cards render.
- Pages to validate at minimum: home, one product page, one use-case page, one blog post.

### Sitemaps & feeds
- `sitemap.xml` auto-generated via `@astrojs/sitemap`.
- `robots.txt` in `public/` (see AI-bot policy in the next section).
- **RSS / Atom feed** at `/rss.xml` via `@astrojs/rss` — **full post content** in feed items (AI ingestion + traditional reader discoverability).
- **Video sitemap entries** — pages with embedded YouTube videos emit Google Video Sitemap extensions (`<video:video>` with `thumbnail_loc`, `title`, `description`, `content_loc`, `player_loc`, `duration`). Generated at build time from a central registry (`src/data/videos.ts`) populated as videos are embedded via the `<Video>` component. Ensures Google's video index discovers embedded (not hosted) videos.

### Navigation context
- **Breadcrumbs** on product, use-case, and blog pages — rendered visibly in the UI and as `BreadcrumbList` JSON-LD. Helps humans and crawlers understand hierarchy.

### Search engine submission (post-launch, week 1)
- **Google Search Console**: verify domain, submit `sitemap.xml`, monitor indexing.
- **Bing Webmaster Tools**: verify domain, submit `sitemap.xml`.
- **IndexNow**: on publish of a new or meaningfully-updated page, POST the URL to the IndexNow API (Bing, Yandex, others index within minutes). Implemented as a simple post-deploy hook on Vercel that diffs the sitemap.

### Redirects
- `/main` → `/` (301, in `vercel.json`).
- Any other host/path oddities discovered during crawl (e.g., `www.` vs bare host) handled via Vercel redirects.

## AI / LLM crawlability

AI systems (ChatGPT, Perplexity, Claude, Google AI Overviews, etc.) are an increasingly important traffic and recommendation channel for a B2B security vendor. AI crawlers generally do not execute JavaScript — they read the raw HTML response. Astro's static-first output is already a strong baseline; the following additions make the site first-class for AI ingestion and grounding.

### JSON-LD structured data (Schema.org)
Embed one `<script type="application/ld+json">` block per page in `BaseLayout` (site-wide) and per page (page-specific), merging as appropriate:

- **Site-wide (every page)**: `Organization` schema — name, URL, logo, sameAs links (LinkedIn, X/Twitter, etc.), description.
- **Home page**: `WebSite` schema (with `SearchAction` if on-site search ever exists).
- **Product pages** (`/instaaccess`, `/instaworkforce`): `SoftwareApplication` or `Product` schema — name, description, applicationCategory ("SecurityApplication"), offers if relevant, operatingSystem ("Cloud/AWS"), publisher (InstaSecure).
- **Use-case pages** (`/credential-compromise`, etc.): `WebPage` with descriptive `about` referencing the problem domain.
- **Blog posts**: `Article` or `BlogPosting` — headline, author, datePublished, dateModified, image, description.
- **FAQ sections (anywhere they exist)**: `FAQPage` schema.
- **Contact page**: `ContactPage` with `ContactPoint`.
- **Pages with embedded YouTube videos**: `VideoObject` schema — emitted automatically by the `<Video>` component. Required fields: `name`, `description`, `thumbnailUrl` (YouTube `maxresdefault.jpg`), `uploadDate`, `duration`, `embedUrl`, `contentUrl`.

Implementation: a small `StructuredData.astro` component accepting a typed prop, called from page files or layouts. All output is server-rendered HTML.

### `/llms.txt`
A markdown file served at `instasecure.ai/llms.txt` following the [llmstxt.org](https://llmstxt.org/) convention: a structured, human- and AI-readable summary of the site. Include:
- Company one-liner.
- Products (InstaAccess, InstaWorkforce) with one-paragraph descriptions.
- Key pages (pricing, docs, demo, contact) with links.
- Blog index link.
- AWS Marketplace listing link.

Stored at `public/llms.txt`, updated as a byproduct of any significant content change. Optional companion: `/llms-full.txt` with more detail.

### `robots.txt` with explicit AI-bot policy
Default policy: **allow all major AI crawlers** (InstaSecure is a security vendor that benefits from being cited by AI tools). Explicitly named in `robots.txt` so there's no ambiguity:
- `GPTBot` (OpenAI) — allow
- `PerplexityBot` — allow
- `ClaudeBot` (Anthropic) — allow
- `Google-Extended` (Google AI/Gemini training) — allow
- `Applebot-Extended` (Apple AI) — allow
- `CCBot` (Common Crawl — backs many training datasets) — allow
- Plus standard search-engine rules.

Listed explicitly so future changes are intentional, not accidental.

### Freshness signals
Emit `datePublished` and `dateModified` on all pages that render an `Article` / `BlogPosting` / `WebPage` schema. Pages can pull `dateModified` from git commit metadata or hand-set frontmatter, surfaced in both JSON-LD and (optionally) a subtle `<time>` element on the page.

### Semantic HTML
Explicit requirement for page components: single `<h1>` per page (usually the hero headline), meaningful heading hierarchy, `<ul>`/`<ol>` for lists, `<table>` for tabular data, descriptive `<a>` link text. Section components enforce this structure by default.

### Content patterns for AI extraction
Writing patterns that make content quotable and extractable by LLMs:
- **TL;DR / summary block** at the top of long pages and every blog post — AI frequently pulls these verbatim into summary responses.
- **FAQ / Q&A sections** on product and use-case pages, tagged with `FAQPage` schema. LLMs treat these as high-quality question-answer pairs.
- **Data-driven specifics**: prefer "scales to 10,000 IAM roles" over "scales well"; "reduced audit prep from 6 weeks to 3 days" over "faster audits". AI quotes specifics; it deprioritizes adjectives.
- **Comparison tables** on use-case and product pages where relevant — AI extracts tables cleanly and often quotes rows wholesale.
- **One-claim-per-sentence style** in key sections — makes extraction clean and reduces chances of misattribution or distortion.
- **Video transcripts rendered inline** — every page with an embedded YouTube video includes its transcript in a `<details>` block. AI crawlers cannot watch videos; the transcript is what makes the spoken content visible, indexable, and citable. This is the single biggest AI-crawlability lever on any page that leans on video.

### Validation
Before cutover, verify with:
- Google [Rich Results Test](https://search.google.com/test/rich-results) on home, one product page, one blog post — JSON-LD must validate.
- Manual `curl https://<preview-url>/<page>` check — inspect raw HTML for all content (no "loading..." placeholders).
- `curl https://<preview-url>/llms.txt` returns a valid markdown summary.

## Performance, security & quality

Beyond Astro's static-first baseline:

### Perceived performance & UX
- **View Transitions** (Astro v5 native) — smooth cross-page transitions, signals a modern stack to users and to Google's page-experience signal.
- **Prefetch on hover + viewport** via Astro's prefetch integration — the next page is usually already fetched by the time the user clicks. Cuts perceived latency to near-zero.
- **Speculation Rules API** (Chrome-first progressive enhancement) — declare high-confidence navigations for prerendering.
- **Self-hosted fonts** in `public/fonts/` with `font-display: swap` and Latin subsetting — eliminates third-party font round-trip; improves LCP and CLS.

### Third-party script hygiene
- **Partytown** via `@astrojs/partytown` — runs analytics and marketing scripts (GA4, LinkedIn Insight Tag, etc.) inside a web worker. Keeps the main thread free → markedly better INP and interaction responsiveness scores.
- **YouTube facade embeds** via `astro-embed` (or `lite-youtube-embed`) in the shared `<Video>` component — real iframe loads only on user click. Without this, any page with an embedded video drops below Lighthouse 90 regardless of other optimizations.

### Security headers & trust (extra-load-bearing for a security vendor)
- **HTTP security headers** via `vercel.json`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy` — restrictive allowlist covering Vercel, Formspree, analytics, fonts
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` — deny unused sensors/APIs
- **`/.well-known/security.txt`** per RFC 9116 — security contact, policy URL, PGP key (if used). A security vendor without `security.txt` is a credibility hit.
- **HSTS preload submission** (optional, after a few weeks of confident operation) via `hstspreload.org`.

### Monitoring & quality gates
- **Vercel Speed Insights** — real-user Core Web Vitals (LCP, INP, CLS). One-line opt-in; free tier.
- **CI link-check** via `lychee` in GitHub Actions on every PR and on a weekly cron — catches link rot before visitors do.
- **Lighthouse CI** (optional) — tracks perf regressions across PRs.

## Authority & E-E-A-T signals

Google's E-E-A-T framework (Experience, Expertise, Authoritativeness, Trustworthiness) and LLM trust heuristics both reward specific, verifiable authorship and social proof. For a B2B security vendor, this is especially load-bearing.

### People & authorship
- **Author bios on blog posts** — name, title, 2–3 sentence bio, optional photo, LinkedIn link. Rendered via an `Author` component backed by structured data in `src/data/authors.ts`. Referenced by `Article.author` in JSON-LD.
- **Team page** (or expanded `/about`) — key people with titles and LinkedIn links. Signals real humans behind the claims.

### Trust badges & compliance
- **Certifications** — SOC 2, ISO 27001, AWS Partner, Cyber Essentials, etc. — whichever InstaSecure holds, with issuer links where verifiable.
- **AWS Marketplace badge** with link (already on the current site).

### Social proof
- **Customer logos** on the homepage (with explicit permission).
- **Testimonial quotes** with **named attribution** (name, title, company) — not anonymous.
- **Case study section / page** — specific outcomes with numbers, even if a single page to start.

### Press / coverage (if applicable)
- "As seen in" strip with logos of publications that have covered the company, linked to the coverage.

## Visual regression comparison

**Purpose.** Catch unintended visual drift between the current Squarespace site and the Astro rebuild. Because the decision was "close visual match, clean rebuild" (not pixel-exact), *some* drift is expected and desired — the goal is to surface all drift for human review, not to enforce pixel parity.

**Tool: Playwright (`@playwright/test`).** Rationale:
- Headless Chromium built-in; easy full-page screenshots with network-idle/font-load waits.
- Reusable for future e2e tests (good long-term investment vs. a single-purpose tool like BackstopJS).
- Native integration with `pixelmatch` or Playwright's own `toHaveScreenshot()` for diffing.
- No SaaS dependency.

Chrome extensions (PerfectPixel, Page Ruler) remain useful for ad-hoc manual spot checks during development — but don't scale to 28 pages × 3 viewports.

### What gets captured
- All URLs from the sitemap (28 pages + 6 blog posts + blog index).
- Three viewports: **360×800 (mobile), 768×1024 (tablet), 1440×900 (desktop)**.
- Full-page screenshots (scrolled), captured after `networkidle` and document fonts loaded.
- Cookie / popup banners dismissed before capture via a selector list configured in the script.

### Script layout
```
tests/visual/
├── compare.config.ts     # URL list, viewports, ignore-selectors, banner-dismiss selectors
├── capture.spec.ts       # Playwright spec — captures baseline or current based on env
├── diff.mjs              # diff using pixelmatch; emits report.html
├── baseline/             # screenshots from current Squarespace site
├── current/              # screenshots from new Vercel preview
├── diff/                 # pixel diff PNGs
└── report.html           # side-by-side table with % diff per page/viewport
```

### Workflow
1. **Phase 0 (early)**: `BASELINE_URL=https://instasecure.ai npm run visual:capture` — records the "before" of the live Squarespace site **before** anything is touched. This is the record of what we're migrating from.
2. **Phase 6 (before cutover)**: `CURRENT_URL=<preview-url> npm run visual:capture` — captures the new Astro site on Vercel preview.
3. `npm run visual:diff` — produces `tests/visual/report.html`: side-by-side old/new/diff PNGs with a percentage difference per page × viewport.
4. Open the report, review every page with >10% diff. Each is classified: **intentional improvement** (approve) or **regression** (fix before cutover).

### Thresholds and CI policy
- **Report-only, not a CI gate.** Since the design is intentionally changing, a blanket percentage threshold would be noise. Human review is the mechanism.
- Pages with a large diff but explicitly approved are noted in a `tests/visual/approved-drift.md` file so reviewers on future visual comparisons can see prior decisions.

### Constraints
- Baseline **must** be captured before DNS cutover — once DNS flips, the old Squarespace site is no longer reachable at `instasecure.ai`. It'll remain reachable at its Squarespace-provided URL until the subscription is canceled, but capturing early is simpler than changing the baseline URL later.
- Baseline captures of dynamic elements (e.g., rotating testimonials, dated blog list) may differ between runs — the ignore-selectors list masks these regions.

## Cutover

### Plan
1. 24h before cutover: lower DNS TTL at the domain registrar to 300s.
2. Final gate: all pages verified on the Vercel preview URL; Lighthouse + link-check green (see "Definition of done" below).
3. Cutover: update DNS `A`/`CNAME` records at the registrar per Vercel's instructions.
4. Vercel auto-issues SSL (typically <2 minutes).
5. Monitor 24–48h: broken links, analytics ticking over, form submissions arriving, OG cards rendering.

### Rollback
If the cutover reveals problems: revert DNS back to Squarespace. The Squarespace site stays intact until cancellation — cancellation happens 1–2 weeks after a stable cutover, separately from this project.

## Definition of done (pre-cutover gate)

### Content & correctness
- All 28 content pages, `/blog` index, and `/blog/[slug]` route render correctly on the preview URL.
- `DemoForm` and `ContactForm` submissions deliver to configured email.
- `/main` redirect verified working.
- No console errors on any page.
- `curl <page>` on any page returns full content in raw HTML (no JS-only-rendered content).

### SEO & discoverability
- `sitemap.xml` reachable at `/sitemap.xml`.
- RSS feed reachable at `/rss.xml` and contains full content of the latest blog posts.
- Breadcrumbs visible on product, use-case, and blog pages; `BreadcrumbList` JSON-LD validates.
- Link-check script reports no broken links.

### Social sharing cards
- Auto-generated OG images render with page title + brand treatment; 1200×630 PNG, <500 KB, absolute HTTPS URL.
- OG cards validate on home, one product page, one use-case page, and one blog post via: Facebook Sharing Debugger, LinkedIn Post Inspector, X / Twitter Card Validator.
- Manual paste test passes in Slack, Discord, and Reddit (to `r/test` or sandbox).
- `theme-color` meta present and correct.

### AI crawlability
- JSON-LD validates on home, one product page, one blog post via Google's Rich Results Test.
- `/llms.txt` reachable and contains a valid markdown site summary.
- `robots.txt` explicitly lists AI-bot policy (GPTBot, PerplexityBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot).
- FAQ schema validates on at least one page that uses it.
- `VideoObject` JSON-LD validates on a page with an embedded YouTube video.
- Video transcript renders in a `<details>` block on every page that has an embedded video.

### Performance & security
- Lighthouse ≥ 90 on Performance, Accessibility, SEO, Best Practices for home and one product page.
- Lighthouse ≥ 90 Performance on a page containing an embedded YouTube video — facade embed verified (no 1+ MB iframe load before user click).
- Vercel Speed Insights enabled, emitting RUM.
- View Transitions functional on cross-page navigation in Chrome.
- Partytown active — analytics requests verified to originate from a web worker (DevTools Network).
- securityheaders.com grade A or A+.
- `/.well-known/security.txt` reachable and valid per RFC 9116.

### Authority & trust
- Author bio rendered on at least one blog post.
- Team page lists 2+ people with LinkedIn links.
- Trust badges (SOC 2 / AWS Partner / etc. — whichever apply) present on the homepage.

### Visual parity
- Playwright baseline captured (pre-migration) exists in `tests/visual/baseline/` for all 28 pages × 3 viewports.
- Playwright current captures completed against the preview URL.
- `tests/visual/report.html` generated and reviewed — every page with diff > 10% is classified in `tests/visual/approved-drift.md` as either intentional (approved) or regression (already fixed before cutover).

### CI
- Link-check job runs green on `main`.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Visual drift from current Squarespace design | Deliberate: user chose "close visual match, clean rebuild" over pixel-exact. Side-by-side visual QA during phase 6 before cutover. |
| Current Squarespace analytics not trivially portable | Phase 6 inspects the live tag; if the provider is unexpected, user decides whether to replicate (e.g., GA4, Plausible) or skip. Not a cutover blocker. |
| DNS cutover drops traffic briefly | Low TTL pre-cutover; Vercel SSL issuance is typically <2 min. |
| Inbound links broken | Flat URLs preserved 1:1; `/main` redirect handles the one known oddity. |
| Formspree free tier insufficient at volume | Monitor post-cutover; upgrade plan or switch to Vercel serverless + Resend if needed. |
| Squarespace HTML scrape misses some copy nuance | Manual per-page QA in phase 6; user spot-checks against live site before cutover. |

## Details resolved during implementation (non-blocking)

These are determined from the live site rather than decided up-front:

- **Current analytics provider** — detect in phase 6 by inspecting the live page's `<head>`. Replicate it, or substitute GA4 if the current provider is Squarespace-proprietary.
- **Brand font family and exact color palette** — extract in phase 0 from the live site's CSS; encode as tokens in `theme.css`.
- **Exact section inventory per page** (e.g., how many CTA blocks a use-case page has) — discovered page-by-page during phases 1–4.

## Appendix: Post-launch content program (Tier 2)

Not required to ship the migration. Captured here so the content program that compounds authority after launch is part of the plan rather than assembled ad hoc. Each item below is the kind of thing that takes a day or more of focused work — these are the highest-leverage authority moves for the first 6–12 months post-launch.

### Comparison pages
Slug pattern: `/compare/<our-product>-vs-<alternative>`. Each page: problem framing → side-by-side feature table → honest pros/cons of each → when-to-choose-which → CTA. Example candidates:
- `/compare/instaaccess-vs-aws-iam-access-analyzer`
- `/compare/instaaccess-vs-cloud-custodian`
- `/compare/instaworkforce-vs-aws-iam-identity-center`

Comparison pages rank well on high-intent evaluation queries and are magnets for AI citations because AI systems frequently get asked "which of X or Y should I use".

### Glossary
Slug pattern: `/glossary/<term>` (e.g., `/glossary/least-privilege`, `/glossary/service-control-policy`, `/glossary/just-in-time-access`). Each page: one-to-two-sentence definition → longer explanation → related terms → relevance to InstaSecure. Authoritative glossary pages become reference points LLMs cite when defining the term.

### Original research / data reports
One data-backed publication per quarter is the single biggest authority lever. Example shapes:
- "Analysis of N AWS IAM misconfigurations across M accounts"
- "State of preventive cloud security, 2026"
- "Most common audit-failing access patterns"

Publish as a pillar page with an optional downloadable PDF; cross-link from relevant product and use-case pages.

### Case studies with numbers
One per quarter, with specific named outcomes. Format: `customer name + logo → problem → solution → result with metrics`. Schema: `Article` or `CaseStudy` + `Organization`. Prefer specificity over polish.

### Topical clusters (pillar-and-spoke)
Treat each product page as a "pillar" and the use-case pages as "spokes". Expand the spokes as a content program:
- From `/instaaccess`: spokes on IAM automation, service control policies, zero-standing-access, AWS Organizations security
- From `/instaworkforce`: spokes on just-in-time access, break-glass procedures, periodic access reviews, SSO integration

Two-way linking (pillar ↔ spoke) is what convinces search engines of topical depth and helps LLMs navigate the site's expertise.
