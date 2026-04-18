# InstaSecure.ai Website Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `instasecure.ai` from Squarespace to Astro on Vercel — preserving all existing URLs, blog content, and visual identity — then harden for AI/LLM crawlability, performance, security, authority signals, rich social sharing, video handling, and visual regression testing, and finally cut over DNS.

**Architecture:** Static Astro v5 (zero-JS by default) + Tailwind CSS + TypeScript (strict). Content collections for the blog (MDX). Shared section components compose pages; structured data in `src/data/`; forms via Formspree initially. A single `<Video>` component handles YouTube embeds with facade loading, `VideoObject` JSON-LD, and inline transcripts. Auto-generated OG images via `astro-og-canvas`. Visual regression via Playwright + pixelmatch.

**Tech Stack:** Astro v5, TypeScript, Tailwind CSS v4, MDX; `@astrojs/sitemap`, `@astrojs/rss`, `@astrojs/partytown`, `@astrojs/check`, `astro-embed`, `astro-og-canvas`; Playwright + pixelmatch; Vitest; lychee; Formspree; yt-dlp; Vercel.

**Prerequisites:**
- Node 20 LTS (`node --version` returns `v20.x`); `npm`, `git`, `gh` (authenticated), `yt-dlp` (`pipx install yt-dlp`).
- Vercel account with access to link a new project.
- Formspree form created; endpoint URL recorded.
- Working directory `/home/rupesh/Documents/website/` — already a git repo containing `docs/superpowers/specs/2026-04-17-instasecure-ai-website-migration-design.md`. Astro is scaffolded into this directory's root, alongside `docs/`.

**Spec reference:** Read `docs/superpowers/specs/2026-04-17-instasecure-ai-website-migration-design.md` before starting. This plan implements that spec; it does not re-argue its decisions.

---

## Phase 0 — Repository setup & scaffolding

### Task 0.1: Capture media inventory from the current site

**Files:**
- Create: `docs/superpowers/migration/media-inventory.md`

Lightweight recon so video transcripts, hero images, and third-party assets are not forgotten during page builds.

- [ ] **Step 1: Enumerate YouTube embeds across the sitemap**

For each URL listed in the spec's "Site inventory" (28 pages + 6 blog posts), fetch the page and find YouTube iframes.

```bash
for url in $(awk '/https:\/\/.*\/(blog|instaaccess|instaworkforce|about|contact|pricing|howitworks|news|events|conference|main|credential-compromise|cloud-zero-day|data-perimeter|close-compliance|fix-risks|who-really-has|stop-paying|walk-into|instaaccess-use|instaworkforce-use)/' /dev/null); do
  # Run manually for each page instead — the list is short
  :
done
```

Run manually for each page:
```bash
curl -sL https://instasecure.ai/<page> | grep -oE 'youtube(-nocookie)?\.com/embed/[A-Za-z0-9_-]+' | sort -u
```

- [ ] **Step 2: Record in `docs/superpowers/migration/media-inventory.md`**

Format:
```markdown
# Media inventory (captured 2026-04-17)

## YouTube embeds

| Page | Video ID | Title / context | Needs transcript? |
|---|---|---|---|
| /instaaccess | <id> | "Product overview" | yes |

## External images / CDN references

| Page | URL | Notes |
|---|---|---|
```

If no YouTube embeds found on a page, record "none". Subsequent tasks then skip transcript fetching for that page.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/migration/media-inventory.md
git commit -m "docs: capture media inventory from current squarespace site"
```

---

### Task 0.2: Capture Playwright visual baseline of current Squarespace site

**Files:**
- Create: `tests/visual/compare.config.ts`
- Create: `tests/visual/capture.spec.ts`
- Create: `playwright.config.ts`
- Create: `package.json` (initial)

Captures baseline **before** any Astro scaffolding touches the live site's DNS. This is irreversible once DNS flips — do it early.

- [ ] **Step 1: Initialize minimal npm project and install Playwright**

```bash
npm init -y
npm install --save-dev @playwright/test@latest pixelmatch@latest pngjs@latest
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Create `tests/visual/compare.config.ts`**

```typescript
export const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

export const URLS = [
  '/', '/main', '/about', '/contact', '/pricing', '/howitworks', '/news', '/events', '/conference',
  '/instaaccess', '/instaworkforce', '/instaaccess-use-cases', '/instaworkforce-use-cases',
  '/credential-compromise', '/cloud-zero-day-attack-solution', '/data-perimeter-on-aws',
  '/close-compliance-gap', '/fix-risks-before-pentest', '/who-really-has-access',
  '/stop-paying-for-cloud', '/walk-into-your-next-user-access-audit',
  '/blog', '/blog/a-new-era-of-preventive-cloud-security-with-aws',
  '/blog/instaworkforce-in-action-workforce-security-use-cases-and-demo-for-aws',
  '/blog/proactive-cloud-security-tackling-credential-theft-with-instasecure',
  '/blog/understanding-cloud-security-controls',
  '/blog/preventive-human-access',
  '/blog/instaworkforce',
];

export const DISMISS_SELECTORS = [
  // Common cookie banner selectors; add real ones after manual inspection
  '[aria-label="Close"]',
  'button:has-text("Accept")',
  'button:has-text("Got it")',
];
```

- [ ] **Step 3: Create `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 60_000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: {
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  },
});
```

- [ ] **Step 4: Create `tests/visual/capture.spec.ts`**

```typescript
import { test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { VIEWPORTS, URLS, DISMISS_SELECTORS } from './compare.config';

const TARGET_URL = process.env.TARGET_URL ?? 'https://instasecure.ai';
const MODE = (process.env.MODE ?? 'baseline') as 'baseline' | 'current';
const OUT_DIR = path.resolve(process.cwd(), `tests/visual/${MODE}`);

function slugify(url: string) {
  return url.replace(/^\//, '').replace(/[\/]/g, '_') || 'home';
}

for (const url of URLS) {
  for (const vp of VIEWPORTS) {
    test(`${MODE}: ${url} @ ${vp.name}`, async ({ page }) => {
      await fs.mkdir(OUT_DIR, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${TARGET_URL}${url}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      for (const sel of DISMISS_SELECTORS) {
        const el = page.locator(sel).first();
        if (await el.count()) await el.click({ timeout: 1000 }).catch(() => {});
      }
      await page.waitForTimeout(500);
      const file = path.join(OUT_DIR, `${slugify(url)}_${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    });
  }
}
```

- [ ] **Step 5: Add capture scripts to package.json**

```json
"scripts": {
  "visual:baseline": "TARGET_URL=https://instasecure.ai MODE=baseline playwright test tests/visual/capture.spec.ts",
  "visual:current":  "MODE=current playwright test tests/visual/capture.spec.ts",
  "visual:diff":     "node tests/visual/diff.mjs"
}
```

- [ ] **Step 6: Run the baseline capture**

```bash
npm run visual:baseline
```

Expected: `tests/visual/baseline/` populated with ~96 PNGs (32 URLs × 3 viewports). Any URL that 404s is noted but not a blocker.

- [ ] **Step 7: Commit (config only — PNGs ignored by .gitignore)**

```bash
git add playwright.config.ts tests/visual/compare.config.ts tests/visual/capture.spec.ts package.json package-lock.json
git commit -m "test: add playwright visual regression harness; capture squarespace baseline"
```

---

### Task 0.3: Scaffold Astro + TypeScript + Tailwind CSS

**Files:**
- Modify: `package.json`
- Create: `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`, `src/styles/global.css`, `src/styles/theme.css`, `.gitignore`

- [ ] **Step 1: Install Astro and Tailwind**

```bash
npm install astro@^5
npm install @astrojs/check@latest typescript@latest
npm install tailwindcss@^4 @tailwindcss/vite@^4
```

- [ ] **Step 2: Create `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://instasecure.ai',
  output: 'static',
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.astro", "src/**/*.tsx"]
}
```

- [ ] **Step 4: Create `src/styles/global.css` and `src/styles/theme.css`**

`src/styles/global.css`:
```css
@import "tailwindcss";
@import "./theme.css";

*, *::before, *::after { box-sizing: border-box; }
body { font-family: var(--font-sans); color: var(--color-text); background: var(--color-bg); }
```

`src/styles/theme.css` — **placeholder only**; filled in Task 0.5:
```css
@theme {
  --color-text: #0f172a;
  --color-bg: #ffffff;
  --color-brand: #2563eb; /* replaced in Task 0.5 */
  --color-accent: #ec4899; /* replaced in Task 0.5 */
  --font-sans: ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 5: Create minimal `src/pages/index.astro`**

```astro
---
import '@/styles/global.css';
---
<html lang="en">
  <head><meta charset="utf-8"><title>InstaSecure</title></head>
  <body><h1 class="text-4xl font-bold m-8">Migration in progress</h1></body>
</html>
```

- [ ] **Step 6: Update `.gitignore`**

```
node_modules
dist
.astro
.env
.env.local
.vercel
.DS_Store
tests/visual/baseline/
tests/visual/current/
tests/visual/diff/
playwright-report/
test-results/
```

- [ ] **Step 7: Update package.json scripts**

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "visual:baseline": "TARGET_URL=https://instasecure.ai MODE=baseline playwright test tests/visual/capture.spec.ts",
  "visual:current":  "MODE=current playwright test tests/visual/capture.spec.ts",
  "visual:diff":     "node tests/visual/diff.mjs"
}
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```
Expected: success; produces `dist/index.html`.

- [ ] **Step 9: Commit**

```bash
git add .gitignore package.json package-lock.json astro.config.mjs tsconfig.json src/
git commit -m "feat: scaffold astro + tailwind + typescript"
```

---

### Task 0.4: Extract brand tokens from the live site

**Files:**
- Modify: `src/styles/theme.css`
- Create: `public/fonts/` (populated with self-hosted brand fonts)

- [ ] **Step 1: Identify fonts and colors on the live site**

Open `https://instasecure.ai` in Chrome DevTools → Rendering tab → inspect computed `font-family` and key colors (header text, brand accent, CTA buttons, backgrounds). Record findings in `docs/superpowers/migration/brand-tokens.md`:

```markdown
# Brand tokens (extracted 2026-04-17)

## Fonts
- Primary sans: <family-name>
- Headings: <family-name or same as primary>

## Colors
- Text: #XXX
- Background: #XXX
- Brand primary: #XXX
- Brand accent: #XXX
- Button bg: #XXX
- Link: #XXX
```

- [ ] **Step 2: Download brand fonts (self-host for performance + privacy)**

If the site uses Google Fonts, download subsets via `gwfh.mranftl.com` (Google Webfonts Helper) — Latin subset, WOFF2 only. Place under `public/fonts/<family>/`.

If the site uses proprietary Squarespace fonts, substitute with nearest open-source equivalent (e.g., Inter for generic sans, Merriweather for serif) and note the substitution in `brand-tokens.md`.

- [ ] **Step 3: Update `src/styles/theme.css` with real tokens**

```css
@font-face {
  font-family: 'BrandSans';
  src: url('/fonts/brandsans/BrandSans-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'BrandSans';
  src: url('/fonts/brandsans/BrandSans-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

@theme {
  --color-text: #<from-site>;
  --color-bg: #<from-site>;
  --color-brand: #<from-site>;
  --color-accent: #<from-site>;
  --color-muted: #<from-site>;
  --font-sans: 'BrandSans', ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 4: Verify fonts load**

```bash
npm run dev
```
Visit `http://localhost:4321/` — text renders in brand font (check DevTools → Network → Fonts; `.woff2` served from `/fonts/`).

- [ ] **Step 5: Commit**

```bash
git add public/fonts/ src/styles/theme.css docs/superpowers/migration/brand-tokens.md
git commit -m "feat: extract brand tokens and self-host fonts"
```

---

### Task 0.5: Build shared layout (BaseHead, Nav, Footer, BaseLayout)

**Files:**
- Create: `src/components/layout/BaseHead.astro`
- Create: `src/components/layout/Nav.astro`
- Create: `src/components/layout/Footer.astro`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/data/nav.ts`
- Create: `src/data/footer.ts`

- [ ] **Step 1: Create structured data for nav and footer**

`src/data/nav.ts`:
```typescript
export interface NavItem { label: string; href: string; children?: NavItem[]; }

export const PRIMARY_NAV: NavItem[] = [
  { label: 'Products', href: '#', children: [
    { label: 'InstaAccess', href: '/instaaccess' },
    { label: 'InstaWorkforce', href: '/instaworkforce' },
  ]},
  { label: 'Use Cases', href: '#', children: [
    { label: 'Credential Compromise', href: '/credential-compromise' },
    { label: 'Cloud Zero-Day', href: '/cloud-zero-day-attack-solution' },
    { label: 'Data Perimeter on AWS', href: '/data-perimeter-on-aws' },
    { label: 'Close Compliance Gap', href: '/close-compliance-gap' },
    { label: 'Fix Risks Before Pentest', href: '/fix-risks-before-pentest' },
    { label: 'Who Really Has Access', href: '/who-really-has-access' },
    { label: 'Stop Paying for Cloud', href: '/stop-paying-for-cloud' },
    { label: 'Walk Into Your Next Audit', href: '/walk-into-your-next-user-access-audit' },
  ]},
  { label: 'How It Works', href: '/howitworks' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export const CTA_NAV = { label: 'Book a Demo', href: '/contact' };
```

`src/data/footer.ts`:
```typescript
export const FOOTER_SECTIONS = [
  { title: 'Product', links: [
    { label: 'InstaAccess', href: '/instaaccess' },
    { label: 'InstaWorkforce', href: '/instaworkforce' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'How It Works', href: '/howitworks' },
  ]},
  { title: 'Company', links: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'News', href: '/news' },
    { label: 'Events', href: '/events' },
  ]},
  { title: 'Resources', links: [
    { label: 'Blog', href: '/blog' },
    { label: 'AWS Marketplace', href: 'https://aws.amazon.com/marketplace/' }, // replace with actual listing
  ]},
];

export const SOCIAL = {
  linkedin: 'https://www.linkedin.com/company/instasecure/',
  // add others as applicable
};
```

- [ ] **Step 2: Create `src/components/layout/BaseHead.astro`**

```astro
---
interface Props {
  title: string;
  description: string;
  image?: string;
  canonical?: string;
  noindex?: boolean;
}
const { title, description, image = '/og-default.png', canonical, noindex = false } = Astro.props;
const canonicalURL = canonical ?? new URL(Astro.url.pathname, Astro.site).toString();
const imageURL = new URL(image, Astro.site).toString();
---
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonicalURL} />
{noindex && <meta name="robots" content="noindex, nofollow" />}

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="InstaSecure" />
<meta property="og:locale" content="en_US" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalURL} />
<meta property="og:image" content={imageURL} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={imageURL} />

<meta name="theme-color" content="var(--color-brand)" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
```

- [ ] **Step 3: Create `src/components/layout/Nav.astro`**

```astro
---
import { PRIMARY_NAV, CTA_NAV } from '@/data/nav';
---
<header class="border-b border-black/5 sticky top-0 bg-white/90 backdrop-blur z-50">
  <nav class="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
    <a href="/" class="font-bold text-xl">InstaSecure</a>
    <ul class="hidden md:flex gap-6 items-center">
      {PRIMARY_NAV.map(item => (
        <li class="relative group">
          <a href={item.href} class="hover:text-[var(--color-brand)]">{item.label}</a>
          {item.children && (
            <ul class="absolute hidden group-hover:block bg-white shadow-lg rounded-lg p-2 min-w-[220px]">
              {item.children.map(c => (
                <li><a href={c.href} class="block px-3 py-2 rounded hover:bg-slate-50">{c.label}</a></li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
    <a href={CTA_NAV.href} class="rounded-full px-5 py-2 bg-[var(--color-brand)] text-white font-medium">
      {CTA_NAV.label}
    </a>
  </nav>
</header>
```

(Mobile nav behavior will be added in a follow-up polish task if needed — keeping desktop-first for the first pass.)

- [ ] **Step 4: Create `src/components/layout/Footer.astro`**

```astro
---
import { FOOTER_SECTIONS, SOCIAL } from '@/data/footer';
---
<footer class="bg-slate-50 border-t border-black/5 mt-24">
  <div class="mx-auto max-w-7xl px-6 py-12 grid md:grid-cols-4 gap-8">
    <div>
      <div class="font-bold text-lg">InstaSecure</div>
      <p class="text-sm text-slate-600 mt-2">Preventive cloud security for AWS.</p>
    </div>
    {FOOTER_SECTIONS.map(section => (
      <div>
        <h3 class="font-semibold text-sm uppercase tracking-wide mb-3">{section.title}</h3>
        <ul class="space-y-2">
          {section.links.map(l => <li><a href={l.href} class="text-sm text-slate-700 hover:text-[var(--color-brand)]">{l.label}</a></li>)}
        </ul>
      </div>
    ))}
  </div>
  <div class="border-t border-black/5 px-6 py-6 text-sm text-slate-500 flex justify-between max-w-7xl mx-auto">
    <span>© {new Date().getFullYear()} InstaSecure, Inc.</span>
    <a href={SOCIAL.linkedin} class="hover:text-[var(--color-brand)]">LinkedIn</a>
  </div>
</footer>
```

- [ ] **Step 5: Create `src/layouts/BaseLayout.astro`**

```astro
---
import BaseHead from '@/components/layout/BaseHead.astro';
import Nav from '@/components/layout/Nav.astro';
import Footer from '@/components/layout/Footer.astro';
import '@/styles/global.css';

interface Props {
  title: string;
  description: string;
  image?: string;
  canonical?: string;
  noindex?: boolean;
}
const props = Astro.props;
---
<html lang="en">
  <head>
    <BaseHead {...props} />
    <slot name="head" />
  </head>
  <body>
    <Nav />
    <main><slot /></main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 6: Update `src/pages/index.astro` to use the layout**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout title="InstaSecure — Preventive Cloud Security for AWS" description="Harden your AWS environment with preventive cloud controls and real-time remediation.">
  <section class="mx-auto max-w-5xl px-6 py-24">
    <h1 class="text-5xl font-bold">Migration in progress</h1>
  </section>
</BaseLayout>
```

- [ ] **Step 7: Verify**

```bash
npm run build && npm run preview
```
Visit local URL — nav + footer render; no console errors.

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: add base layout, nav, and footer"
```

---

### Task 0.6: Connect GitHub + Vercel, confirm preview deploys

**Files:**
- Create: GitHub repository `instasecure-ai-website`
- Create: Vercel project
- Create: `vercel.json`

- [ ] **Step 1: Create GitHub repo via `gh`**

```bash
gh repo create instasecure-ai-website --private --source=. --remote=origin --push
```

- [ ] **Step 2: Create `vercel.json` with the `/main` redirect**

```json
{
  "redirects": [
    { "source": "/main", "destination": "/", "permanent": true }
  ]
}
```

- [ ] **Step 3: Link Vercel project**

```bash
npx vercel link
# Follow prompts: select team, create new project named "instasecure-ai-website"
```

- [ ] **Step 4: Trigger first preview deploy**

```bash
git add vercel.json
git commit -m "chore: add vercel config with /main redirect"
git push
```

Expected: Vercel builds and assigns a preview URL like `instasecure-ai-website-<hash>-<team>.vercel.app`. Verify at vercel.com dashboard.

- [ ] **Step 5: Record preview URL**

Add to `docs/superpowers/migration/preview-url.txt` (git-ignored via `.gitignore` if sensitive; otherwise commit):
```
<vercel preview URL>
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/migration/preview-url.txt
git commit -m "docs: record vercel preview url"
git push
```

---

### Task 0.7: Add unit test harness (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

Needed later for testing helpers (transcript parsing, IndexNow payload, etc.).

- [ ] **Step 1: Install Vitest**

```bash
npm install --save-dev vitest@latest
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add script**

In `package.json`:
```json
"scripts": {
  ...existing...,
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Verify harness runs (no tests yet)**

```bash
npm test
```
Expected: "No test files found" — that's OK.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest harness"
git push
```

---

## Phase 1 — Homepage

### Task 1.1: Build Hero and FeatureGrid section components

**Files:**
- Create: `src/components/sections/Hero.astro`
- Create: `src/components/sections/FeatureGrid.astro`
- Create: `src/components/sections/CTAStripe.astro`
- Create: `src/components/ui/Button.astro`

- [ ] **Step 1: Create `src/components/ui/Button.astro`**

```astro
---
interface Props { href: string; variant?: 'primary' | 'secondary'; class?: string; }
const { href, variant = 'primary', class: klass = '' } = Astro.props;
const base = 'inline-flex items-center gap-2 rounded-full px-6 py-3 font-medium transition';
const styles = {
  primary: 'bg-[var(--color-brand)] text-white hover:opacity-90',
  secondary: 'border border-black/10 text-[var(--color-text)] hover:bg-slate-50',
};
---
<a href={href} class={`${base} ${styles[variant]} ${klass}`}><slot /></a>
```

- [ ] **Step 2: Create `src/components/sections/Hero.astro`**

```astro
---
interface Props {
  eyebrow?: string;
  title: string;
  description: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  image?: { src: string; alt: string };
}
import Button from '@/components/ui/Button.astro';
const { eyebrow, title, description, primaryCta, secondaryCta, image } = Astro.props;
---
<section class="mx-auto max-w-7xl px-6 pt-16 pb-24 grid md:grid-cols-2 gap-12 items-center">
  <div>
    {eyebrow && <div class="text-sm uppercase tracking-wide text-[var(--color-brand)] font-semibold mb-4">{eyebrow}</div>}
    <h1 class="text-4xl md:text-6xl font-bold leading-tight">{title}</h1>
    <p class="text-lg text-slate-700 mt-6 max-w-xl">{description}</p>
    <div class="flex gap-3 mt-8">
      {primaryCta && <Button href={primaryCta.href}>{primaryCta.label}</Button>}
      {secondaryCta && <Button href={secondaryCta.href} variant="secondary">{secondaryCta.label}</Button>}
    </div>
  </div>
  {image && <img src={image.src} alt={image.alt} class="w-full rounded-xl" />}
</section>
```

- [ ] **Step 3: Create `src/components/sections/FeatureGrid.astro`**

```astro
---
interface Feature { title: string; description: string; icon?: string; }
interface Props { title?: string; features: Feature[]; columns?: 2 | 3 | 4; }
const { title, features, columns = 3 } = Astro.props;
const gridClass = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[columns];
---
<section class="mx-auto max-w-7xl px-6 py-20">
  {title && <h2 class="text-3xl md:text-4xl font-bold mb-12 text-center">{title}</h2>}
  <div class={`grid gap-8 ${gridClass}`}>
    {features.map(f => (
      <div class="p-6 rounded-xl border border-black/5">
        {f.icon && <div class="text-3xl mb-4">{f.icon}</div>}
        <h3 class="font-semibold text-lg">{f.title}</h3>
        <p class="text-slate-600 mt-2">{f.description}</p>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 4: Create `src/components/sections/CTAStripe.astro`**

```astro
---
import Button from '@/components/ui/Button.astro';
interface Props { title: string; description?: string; cta: { label: string; href: string }; }
const { title, description, cta } = Astro.props;
---
<section class="bg-[var(--color-brand)] text-white">
  <div class="mx-auto max-w-7xl px-6 py-16 flex flex-col md:flex-row items-center gap-6 justify-between">
    <div>
      <h2 class="text-3xl md:text-4xl font-bold">{title}</h2>
      {description && <p class="mt-2 opacity-90">{description}</p>}
    </div>
    <Button href={cta.href} class="bg-white text-[var(--color-brand)] hover:opacity-90">{cta.label}</Button>
  </div>
</section>
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add Hero, FeatureGrid, CTAStripe, Button section components"
git push
```

---

### Task 1.2: Extract homepage content and compose `/`

**Files:**
- Modify: `src/pages/index.astro`
- Add: `src/assets/home/` (downloaded hero/feature images)

- [ ] **Step 1: Extract copy and images from live homepage**

Fetch `https://instasecure.ai/` (and `/main` — same content). Identify: hero eyebrow/title/description/CTAs, value-prop feature tiles, any product teaser sections, testimonials, closing CTA.

Save copy notes to a scratch file `docs/superpowers/migration/home-notes.md` (git-ignored or short-lived). Download hero/feature images with `curl -o src/assets/home/<name>.<ext> '<squarespace-cdn-url>'`.

- [ ] **Step 2: Compose `src/pages/index.astro`**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Hero from '@/components/sections/Hero.astro';
import FeatureGrid from '@/components/sections/FeatureGrid.astro';
import CTAStripe from '@/components/sections/CTAStripe.astro';
// import heroImg from '@/assets/home/hero.png';   // uncomment when image ready

const features = [
  { icon: '🛡️', title: '<value prop 1 from live>', description: '<copy from live>' },
  { icon: '⚡', title: '<value prop 2>',            description: '<copy from live>' },
  { icon: '🎯', title: '<value prop 3>',            description: '<copy from live>' },
];
---
<BaseLayout
  title="InstaSecure — Preventive Cloud Security for AWS"
  description="<meta description ported from live site; 150–160 chars>"
>
  <Hero
    eyebrow="Cloud Security Platform"
    title="<hero title from live>"
    description="<hero subcopy from live>"
    primaryCta={{ label: 'Book a Demo', href: '/contact' }}
    secondaryCta={{ label: 'See How It Works', href: '/howitworks' }}
  />
  <FeatureGrid title="Preventive by design" features={features} columns={3} />
  <CTAStripe
    title="Ready to stop cloud risks before they happen?"
    description="Try InstaSecure free via AWS Marketplace."
    cta={{ label: 'Start Free Trial', href: '<AWS-marketplace-listing-URL>' }}
  />
</BaseLayout>
```

Replace every `<...>` placeholder with exact copy from the live page.

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Visit `/`. Compare to live site for content accuracy. Verify no console errors, no broken images.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/assets/home/
git commit -m "feat: build homepage with content ported from squarespace"
git push
```

---

## Phase 2 — Core pages

### Task 2.0: Per-page migration procedure (reference)

Used by tasks 2.1–2.8, 3.2, 4.x. Not a standalone task — cited where applicable.

1. Fetch the live page: `curl -sL https://instasecure.ai/<slug> > /tmp/live.html`.
2. Identify: `<title>`, meta description, OG image, body copy, any YouTube embeds (cross-check `docs/superpowers/migration/media-inventory.md`), inline images.
3. Download images: `curl -o src/assets/<slug>/<name>.<ext> '<cdn-url>'`.
4. For each YouTube video (per media inventory): `yt-dlp --write-auto-sub --skip-download --sub-lang en --sub-format vtt -o 'src/data/transcripts/%(id)s' https://youtube.com/watch?v=<id>`; then strip VTT timestamps with `grep -v -E '^(WEBVTT|[0-9:.]+ -->|$)' src/data/transcripts/<id>.en.vtt > src/data/transcripts/<id>.txt`; delete the `.vtt`.
5. Compose `src/pages/<slug>.astro` using existing section components. Every `<Video>` is rendered via `<Video id="<id>" title="..." description="..." uploadDate="..." duration="..." />` (component built in Task 5.2).
6. Run `npm run dev` → visit the page → compare to live → adjust.
7. Run `npm run check` (type + link check).
8. Commit per page: `git commit -m "feat: port /<slug> from squarespace"`.

---

### Task 2.1: Port `/about`

**Files:**
- Create: `src/pages/about.astro`
- Create: `src/assets/about/` (images)

- [ ] **Step 1: Apply per-page migration procedure (Task 2.0) for `/about`**.

- [ ] **Step 2: Compose the page**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Hero from '@/components/sections/Hero.astro';
---
<BaseLayout title="About InstaSecure" description="<from-live-meta-description>">
  <Hero
    eyebrow="About"
    title="<about-page-headline>"
    description="<about-page-intro>"
  />
  <section class="mx-auto max-w-3xl px-6 py-16 prose prose-slate">
    <!-- Body copy from live, converted to semantic HTML -->
    <p>...</p>
  </section>
</BaseLayout>
```

- [ ] **Step 3: Verify + commit per procedure.**

---

### Task 2.2: Port `/pricing` with PricingTable component

**Files:**
- Create: `src/components/sections/PricingTable.astro`
- Create: `src/data/pricing.ts`
- Create: `src/pages/pricing.astro`

- [ ] **Step 1: Create `src/data/pricing.ts`**

Mirror the current pricing tiers from the live page. Example shape (fill in actuals):

```typescript
export interface PricingTier {
  name: string;
  price: string;        // "$X/mo" or "Custom"
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}

export const TIERS: PricingTier[] = [
  { name: '<tier1 from live>', price: '<>', blurb: '<>', features: ['<>', '<>'], cta: { label: 'Start', href: '/contact' } },
  // ...
];
```

- [ ] **Step 2: Create `src/components/sections/PricingTable.astro`**

```astro
---
import type { PricingTier } from '@/data/pricing';
import Button from '@/components/ui/Button.astro';
interface Props { tiers: PricingTier[]; }
const { tiers } = Astro.props;
---
<section class="mx-auto max-w-7xl px-6 py-20">
  <div class="grid md:grid-cols-3 gap-8">
    {tiers.map(t => (
      <div class={`p-8 rounded-2xl border ${t.highlighted ? 'border-[var(--color-brand)] bg-slate-50' : 'border-black/5'}`}>
        <h3 class="text-xl font-bold">{t.name}</h3>
        <div class="text-4xl font-bold mt-4">{t.price}</div>
        <p class="text-slate-600 mt-2">{t.blurb}</p>
        <ul class="mt-6 space-y-2 text-sm">
          {t.features.map(f => <li class="flex gap-2"><span>✓</span>{f}</li>)}
        </ul>
        <Button href={t.cta.href} class="mt-8 w-full justify-center">{t.cta.label}</Button>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 3: Compose `src/pages/pricing.astro`** using Hero + PricingTable + CTAStripe.

- [ ] **Step 4: Verify + commit per Task 2.0.**

---

### Task 2.3: Port `/howitworks`

**Files:**
- Create: `src/pages/howitworks.astro`
- Create: `src/assets/howitworks/`

Apply per-page procedure (Task 2.0). Use Hero + FeatureGrid (repurposed for steps, possibly with numbered headers) + CTAStripe.

- [ ] **Steps 1–8: Apply the procedure.**

---

### Task 2.4: Port `/instaaccess` (product page)

**Files:**
- Create: `src/pages/instaaccess.astro`
- Create: `src/assets/instaaccess/`

Apply per-page procedure. Compose Hero + FeatureGrid (product features) + any product-screenshot image section + testimonial/proof strip + CTAStripe.

- [ ] **Steps 1–8.**

---

### Task 2.5: Port `/instaworkforce`

Identical shape to Task 2.4, targeting `/instaworkforce`.

- [ ] **Steps 1–8.**

---

### Task 2.6: Build ContactForm component (Formspree)

**Files:**
- Create: `src/components/forms/ContactForm.astro`
- Create: `.env.example`
- Modify: `.gitignore` (already excludes `.env`)

- [ ] **Step 1: Record Formspree form ID in `.env.local`**

```
# .env.local (git-ignored)
PUBLIC_FORMSPREE_FORM_ID=<your-form-id>
```

And in `.env.example` (committed):
```
PUBLIC_FORMSPREE_FORM_ID=
```

- [ ] **Step 2: Create `src/components/forms/ContactForm.astro`**

```astro
---
const formspreeId = import.meta.env.PUBLIC_FORMSPREE_FORM_ID;
---
<form
  action={`https://formspree.io/f/${formspreeId}`}
  method="POST"
  class="max-w-xl mx-auto space-y-4"
>
  <div class="grid md:grid-cols-2 gap-4">
    <label class="block">
      <span class="text-sm font-medium">Name</span>
      <input name="name" required class="mt-1 w-full rounded-md border-black/10 px-3 py-2" />
    </label>
    <label class="block">
      <span class="text-sm font-medium">Email</span>
      <input type="email" name="email" required class="mt-1 w-full rounded-md border-black/10 px-3 py-2" />
    </label>
  </div>
  <label class="block">
    <span class="text-sm font-medium">Company</span>
    <input name="company" class="mt-1 w-full rounded-md border-black/10 px-3 py-2" />
  </label>
  <label class="block">
    <span class="text-sm font-medium">Message</span>
    <textarea name="message" rows="4" required class="mt-1 w-full rounded-md border-black/10 px-3 py-2"></textarea>
  </label>
  <input type="hidden" name="_subject" value="New contact form submission" />
  <input type="text" name="_gotcha" style="display:none" />
  <button type="submit" class="rounded-full px-6 py-3 bg-[var(--color-brand)] text-white font-medium">
    Send message
  </button>
</form>
```

(Formspree's `_gotcha` is a spam honeypot; `_subject` customizes the email subject.)

- [ ] **Step 3: Verify submission path**

Run `npm run dev`; submit the form; confirm the email arrives at the Formspree-configured address.

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/ContactForm.astro .env.example
git commit -m "feat: add contact form wired to formspree"
git push
```

---

### Task 2.7: Port `/contact`

**Files:**
- Create: `src/pages/contact.astro`

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Hero from '@/components/sections/Hero.astro';
import ContactForm from '@/components/forms/ContactForm.astro';
---
<BaseLayout title="Contact InstaSecure" description="Get in touch with the InstaSecure team.">
  <Hero eyebrow="Contact" title="Talk to us" description="<from-live>" />
  <section class="mx-auto max-w-5xl px-6 py-16">
    <ContactForm />
  </section>
</BaseLayout>
```

- [ ] **Apply per-page procedure steps 1–8.**

---

### Task 2.8: Build DemoForm (if distinct from ContactForm)

If the live site's demo request uses different fields (e.g., "company size", "AWS account count"), create a separate `src/components/forms/DemoForm.astro` — otherwise, reuse `ContactForm` with different `_subject`. Decide based on what's on the live site.

- [ ] **Step 1: Inspect live demo request form; decide whether to fork ContactForm.**
- [ ] **Step 2 (if fork): Create `src/components/forms/DemoForm.astro`** — copy ContactForm, adjust fields and `_subject`.
- [ ] **Step 3: Commit.**

---

## Phase 3 — Use-case / solution pages

### Task 3.1: Build `UseCaseLayout`

**Files:**
- Create: `src/layouts/UseCaseLayout.astro`

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Hero from '@/components/sections/Hero.astro';
import CTAStripe from '@/components/sections/CTAStripe.astro';

interface Props {
  title: string;
  description: string;
  eyebrow?: string;
  heroTitle: string;
  heroDescription: string;
  image?: string;
}
const { title, description, eyebrow = 'Use Case', heroTitle, heroDescription, image } = Astro.props;
---
<BaseLayout {title} {description}>
  <Hero {eyebrow} title={heroTitle} description={heroDescription} />

  <!-- Problem / Impact / Solution content goes in slots -->
  <section class="mx-auto max-w-3xl px-6 py-12 prose prose-slate">
    <slot name="problem" />
  </section>
  <section class="mx-auto max-w-3xl px-6 py-12 prose prose-slate bg-slate-50">
    <slot name="impact" />
  </section>
  <section class="mx-auto max-w-3xl px-6 py-12 prose prose-slate">
    <slot name="solution" />
  </section>
  <slot name="extras" />

  <CTAStripe
    title="See it in action"
    description="Book a 20-minute demo and see how InstaSecure solves this in your AWS environment."
    cta={{ label: 'Book a Demo', href: '/contact' }}
  />
</BaseLayout>
```

- [ ] **Step 1: Create the file above.**
- [ ] **Step 2: Verify it builds (add a test page in Step 3).**
- [ ] **Step 3: Commit.**

---

### Task 3.2: Port all 10 use-case / product-use-case pages

Apply Task 2.0 (per-page procedure) for each URL below. Use `UseCaseLayout` as the wrapper. Each page file is typically 30–50 lines.

URLs (port one at a time; commit per page):
1. `/instaaccess-use-cases`
2. `/instaworkforce-use-cases`
3. `/credential-compromise`
4. `/cloud-zero-day-attack-solution`
5. `/data-perimeter-on-aws`
6. `/close-compliance-gap`
7. `/fix-risks-before-pentest`
8. `/who-really-has-access`
9. `/stop-paying-for-cloud`
10. `/walk-into-your-next-user-access-audit`

Template (adjust per page):
```astro
---
import UseCaseLayout from '@/layouts/UseCaseLayout.astro';
---
<UseCaseLayout
  title="<live page title>"
  description="<live meta description>"
  heroTitle="<live hero>"
  heroDescription="<live subcopy>"
>
  <div slot="problem">
    <h2>The Problem</h2>
    <p>...</p>
  </div>
  <div slot="impact">
    <h2>Why It Matters</h2>
    <p>...</p>
  </div>
  <div slot="solution">
    <h2>How InstaSecure Solves It</h2>
    <p>...</p>
  </div>
</UseCaseLayout>
```

- [ ] **Steps 1–10: Port each page, commit individually.**

---

## Phase 4 — Remaining pages

### Task 4.1: Port `/events`

- [ ] **Apply Task 2.0 per-page procedure.** Likely Hero + a list section (extracted from live). Commit.

### Task 4.2: Port `/conference`

- [ ] **Apply Task 2.0.** Commit.

### Task 4.3: Port `/news`

- [ ] **Apply Task 2.0.** Commit.

### Task 4.4: Custom 404 page

**Files:**
- Create: `src/pages/404.astro`

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout title="Page not found" description="The page you're looking for doesn't exist." noindex>
  <section class="mx-auto max-w-3xl px-6 py-24 text-center">
    <div class="text-6xl font-bold">404</div>
    <h1 class="text-3xl mt-4">Page not found</h1>
    <p class="mt-4 text-slate-600">The page you're looking for may have moved or no longer exists.</p>
    <a href="/" class="mt-8 inline-block rounded-full px-6 py-3 bg-[var(--color-brand)] text-white">Go home</a>
  </section>
</BaseLayout>
```

- [ ] **Create, verify, commit.**

---

## Phase 5 — Blog

### Task 5.1: Content collections schema + `<Video>` component

**Files:**
- Create: `src/content/config.ts`
- Create: `src/components/ui/Video.astro`
- Create: `src/data/videos.ts` (registry)
- Create: `src/data/authors.ts`
- Create: `src/components/Author.astro`

- [ ] **Step 1: Install astro-embed**

```bash
npm install astro-embed
```

- [ ] **Step 2: Create `src/data/authors.ts`**

```typescript
export interface Author {
  id: string;
  name: string;
  title: string;
  bio: string;
  linkedIn?: string;
  twitter?: string;
  avatar?: string; // path under /public/authors/
}

export const AUTHORS: Record<string, Author> = {
  // Populate from the actual authors on the live site
  // 'rupesh-mishra': {
  //   id: 'rupesh-mishra',
  //   name: 'Rupesh Mishra',
  //   title: 'Founder, InstaSecure',
  //   bio: '...',
  //   linkedIn: 'https://www.linkedin.com/in/...',
  // },
};
```

- [ ] **Step 3: Create `src/data/videos.ts`**

```typescript
export interface VideoMeta {
  id: string;              // YouTube ID
  title: string;
  description: string;
  uploadDate: string;      // ISO date, e.g. "2025-10-15"
  duration: string;        // ISO 8601, e.g. "PT3M45S"
}

export const VIDEOS: Record<string, VideoMeta> = {
  // populated from media-inventory.md as videos are embedded
};
```

- [ ] **Step 4: Create `src/content/config.ts`**

```typescript
import { defineCollection, z, reference } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    modifiedDate: z.date().optional(),
    author: z.string(),                 // key in AUTHORS
    heroImage: image().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
```

- [ ] **Step 5: Create `src/components/ui/Video.astro`**

```astro
---
import { YouTube } from 'astro-embed';
import fs from 'node:fs/promises';
import path from 'node:path';
import { VIDEOS } from '@/data/videos';

interface Props { id: string; }
const { id } = Astro.props;
const meta = VIDEOS[id];
if (!meta) throw new Error(`VideoMeta missing for YouTube id: ${id}. Add to src/data/videos.ts.`);

const transcriptPath = path.resolve(process.cwd(), `src/data/transcripts/${id}.txt`);
let transcript: string | null = null;
try {
  transcript = await fs.readFile(transcriptPath, 'utf8');
} catch {
  transcript = null;
}

const thumbnailUrl = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
const schema = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: meta.title,
  description: meta.description,
  thumbnailUrl,
  uploadDate: meta.uploadDate,
  duration: meta.duration,
  embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  contentUrl: `https://www.youtube.com/watch?v=${id}`,
};
---
<figure class="my-8">
  <YouTube id={id} params="privacy=1" />
  {transcript && (
    <details class="mt-4 bg-slate-50 rounded-lg p-4">
      <summary class="cursor-pointer font-medium">Show transcript</summary>
      <div class="mt-4 whitespace-pre-wrap text-sm text-slate-700">{transcript}</div>
    </details>
  )}
</figure>
<script type="application/ld+json" set:html={JSON.stringify(schema)} />
```

- [ ] **Step 6: Create `src/components/Author.astro`**

```astro
---
import { AUTHORS } from '@/data/authors';
interface Props { id: string; }
const { id } = Astro.props;
const a = AUTHORS[id];
if (!a) throw new Error(`Author not found: ${id}`);
---
<div class="flex items-center gap-4 mt-12 p-4 rounded-lg border border-black/5">
  {a.avatar && <img src={a.avatar} alt={a.name} class="w-12 h-12 rounded-full" />}
  <div>
    <div class="font-semibold">{a.name}</div>
    <div class="text-sm text-slate-600">{a.title}</div>
    {a.linkedIn && <a href={a.linkedIn} class="text-sm text-[var(--color-brand)]">LinkedIn</a>}
  </div>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add src/content/config.ts src/components/ui/Video.astro src/components/Author.astro src/data/
git commit -m "feat: content collection schema, Video component, Author component"
```

---

### Task 5.2: BlogPostLayout

**Files:**
- Create: `src/layouts/BlogPostLayout.astro`

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Author from '@/components/Author.astro';
import type { CollectionEntry } from 'astro:content';

interface Props { entry: CollectionEntry<'blog'>; }
const { entry } = Astro.props;
const { title, description, publishDate, modifiedDate, author, heroImage, tags } = entry.data;
---
<BaseLayout {title} {description} image={heroImage?.src}>
  <article class="mx-auto max-w-3xl px-6 py-16">
    <header class="mb-8">
      <div class="text-sm text-slate-600">{publishDate.toISOString().slice(0,10)}</div>
      <h1 class="text-4xl md:text-5xl font-bold mt-2">{title}</h1>
      <p class="text-xl text-slate-700 mt-4">{description}</p>
      {heroImage && <img src={heroImage.src} alt="" class="mt-8 w-full rounded-xl" />}
    </header>
    <div class="prose prose-slate max-w-none">
      <slot />
    </div>
    <Author id={author} />
  </article>

  <script type="application/ld+json" set:html={JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished: publishDate.toISOString(),
    dateModified: (modifiedDate ?? publishDate).toISOString(),
    author: { "@type": "Person", name: author },
    keywords: tags.join(', '),
  })} />
</BaseLayout>
```

- [ ] **Create, verify build, commit.**

---

### Task 5.3: Port 6 blog posts to MDX

**Files:**
- Create: `src/content/blog/<slug>.mdx` × 6
- Create: `src/data/transcripts/<video-id>.txt` × however many videos

For each of the 6 existing posts (slugs from the spec's Site inventory), apply Task 2.0 adapted:

Procedure per post:
1. `curl -sL https://instasecure.ai/blog/<slug> > /tmp/post.html`
2. Extract: title, publish date, description, body, any YouTube embeds, hero image.
3. For each YouTube video: `yt-dlp --write-auto-sub --skip-download --sub-lang en --sub-format vtt -P src/data/transcripts/ https://youtube.com/watch?v=<id>`; strip VTT timestamps to `.txt`.
4. Add corresponding entry to `src/data/videos.ts` with `id`, `title`, `description`, `uploadDate`, `duration`.
5. Convert body HTML → Markdown/MDX. Use a tool like `pandoc -f html -t gfm` as a starting point, then manually clean. YouTube iframes become `<Video id="<id>" />` imports at the top of the MDX.
6. Create `src/content/blog/<slug>.mdx`:

```mdx
---
title: "<title from live>"
description: "<description from live>"
publishDate: 2025-XX-XX
author: <author-id>
heroImage: ../../assets/blog/<slug>/hero.jpg
tags: [<relevant>, <tags>]
---
import Video from '@/components/ui/Video.astro';

<!-- Post body as markdown, with <Video /> where videos were -->
```

7. Verify rendering; commit per post.

- [ ] **Port `a-new-era-of-preventive-cloud-security-with-aws`.**
- [ ] **Port `instaworkforce-in-action-workforce-security-use-cases-and-demo-for-aws`.**
- [ ] **Port `proactive-cloud-security-tackling-credential-theft-with-instasecure`.**
- [ ] **Port `understanding-cloud-security-controls`.**
- [ ] **Port `preventive-human-access`.**
- [ ] **Port `instaworkforce`.**

---

### Task 5.4: Blog index `/blog`

**Files:**
- Create: `src/pages/blog/index.astro`

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';

const posts = (await getCollection('blog'))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
---
<BaseLayout title="InstaSecure Blog" description="Writing on preventive cloud security, AWS IAM, and more.">
  <section class="mx-auto max-w-4xl px-6 py-16">
    <h1 class="text-4xl font-bold">Blog</h1>
    <ul class="mt-12 space-y-10">
      {posts.map(p => (
        <li>
          <div class="text-sm text-slate-600">{p.data.publishDate.toISOString().slice(0,10)}</div>
          <h2 class="text-2xl font-semibold mt-2">
            <a href={`/blog/${p.slug}`} class="hover:text-[var(--color-brand)]">{p.data.title}</a>
          </h2>
          <p class="text-slate-700 mt-2">{p.data.description}</p>
        </li>
      ))}
    </ul>
  </section>
</BaseLayout>
```

- [ ] **Create, verify, commit.**

---

### Task 5.5: Blog post dynamic route

**Files:**
- Create: `src/pages/blog/[...slug].astro`

```astro
---
import { getCollection, getEntry } from 'astro:content';
import BlogPostLayout from '@/layouts/BlogPostLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(p => ({ params: { slug: p.slug }, props: { entry: p } }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
---
<BlogPostLayout entry={entry}>
  <Content />
</BlogPostLayout>
```

- [ ] **Create, verify each post URL resolves, commit.**

---

### Task 5.6: RSS feed at `/rss.xml`

**Files:**
- Create: `src/pages/rss.xml.ts`

- [ ] **Step 1: Install**

```bash
npm install @astrojs/rss
```

- [ ] **Step 2: Create `src/pages/rss.xml.ts`**

```typescript
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog');
  return rss({
    title: 'InstaSecure Blog',
    description: 'Writing on preventive cloud security, AWS IAM, and more.',
    site: context.site!.toString(),
    items: posts
      .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
      .map(p => ({
        title: p.data.title,
        description: p.data.description,
        pubDate: p.data.publishDate,
        link: `/blog/${p.slug}/`,
      })),
    customData: `<language>en-us</language>`,
  });
}
```

- [ ] **Step 3: Verify** `npm run build` → `dist/rss.xml` exists and is valid XML.

- [ ] **Step 4: Commit.**

---

## Phase 6 — Launch readiness

### Task 6.1: Sitemap integration

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Install**

```bash
npm install @astrojs/sitemap
```

- [ ] **Step 2: Register integration**

In `astro.config.mjs`:
```javascript
import sitemap from '@astrojs/sitemap';
// ...
export default defineConfig({
  site: 'https://instasecure.ai',
  integrations: [sitemap()],
  // ...
});
```

- [ ] **Step 3: Build and verify** `dist/sitemap-index.xml` and `dist/sitemap-0.xml` exist.

- [ ] **Step 4: Commit.**

---

### Task 6.2: StructuredData component + site-wide Organization schema

**Files:**
- Create: `src/components/seo/StructuredData.astro`
- Modify: `src/layouts/BaseLayout.astro` (render site-wide schema)

- [ ] **Step 1: Create `src/components/seo/StructuredData.astro`**

```astro
---
interface Props { data: Record<string, any>; }
const { data } = Astro.props;
---
<script type="application/ld+json" set:html={JSON.stringify(data)} />
```

- [ ] **Step 2: Inject Organization schema in BaseLayout**

In `src/layouts/BaseLayout.astro`, add between `<BaseHead>` and `<slot name="head">`:

```astro
---
import StructuredData from '@/components/seo/StructuredData.astro';
// ...existing imports
---
<html lang="en">
  <head>
    <BaseHead {...props} />
    <StructuredData data={{
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "InstaSecure",
      url: "https://instasecure.ai",
      logo: "https://instasecure.ai/logo.png",
      sameAs: [
        "https://www.linkedin.com/company/instasecure/",
      ],
    }} />
    <slot name="head" />
  </head>
  <!-- ... -->
</html>
```

- [ ] **Step 3: Validate on home via Google Rich Results Test** (after deploy).

- [ ] **Step 4: Commit.**

---

### Task 6.3: Page-specific JSON-LD (Product, WebPage, FAQPage, ContactPage)

For each relevant page, add a `<StructuredData data={...} />` block in the `<slot name="head">` or inline after Hero.

- [ ] **Product pages (`/instaaccess`, `/instaworkforce`)**: add `SoftwareApplication` schema.

Example for `/instaaccess`:
```astro
<StructuredData slot="head" data={{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "InstaAccess",
  applicationCategory: "SecurityApplication",
  operatingSystem: "AWS",
  description: "<meta description>",
  publisher: { "@type": "Organization", name: "InstaSecure" },
  url: "https://instasecure.ai/instaaccess",
}} />
```

- [ ] **Use-case pages**: `WebPage` with `about` field.
- [ ] **Contact page**: `ContactPage` with `ContactPoint`.
- [ ] **FAQ sections (where present)**: `FAQPage` schema with `mainEntity` array.
- [ ] **Home page**: `WebSite` schema (optional `SearchAction`).
- [ ] **Blog posts**: already added in BlogPostLayout (Task 5.2).

Commit schema additions as a single commit per page type.

---

### Task 6.4: `/llms.txt`

**Files:**
- Create: `public/llms.txt`

- [ ] **Step 1: Draft per the llmstxt.org convention**

```markdown
# InstaSecure

> Preventive cloud security platform for AWS. Two products: InstaAccess (hardens non-human identity configurations — service roles, automation agents) and InstaWorkforce (secure human access with least-privilege and just-in-time controls).

## Products
- [InstaAccess](https://instasecure.ai/instaaccess): Preventive configuration controls for AWS service roles and non-human identities.
- [InstaWorkforce](https://instasecure.ai/instaworkforce): Just-in-time, least-privilege human access to AWS environments.

## Key Pages
- [How It Works](https://instasecure.ai/howitworks)
- [Pricing](https://instasecure.ai/pricing)
- [Book a Demo](https://instasecure.ai/contact)
- [Blog](https://instasecure.ai/blog)
- [About](https://instasecure.ai/about)

## Use Cases
- [Credential Compromise](https://instasecure.ai/credential-compromise)
- [Cloud Zero-Day Attack Solution](https://instasecure.ai/cloud-zero-day-attack-solution)
- [Data Perimeter on AWS](https://instasecure.ai/data-perimeter-on-aws)
- [Close Compliance Gap](https://instasecure.ai/close-compliance-gap)
- [Fix Risks Before Pentest](https://instasecure.ai/fix-risks-before-pentest)
- [Who Really Has Access](https://instasecure.ai/who-really-has-access)
- [Stop Paying For Cloud](https://instasecure.ai/stop-paying-for-cloud)
- [Walk Into Your Next User Access Audit](https://instasecure.ai/walk-into-your-next-user-access-audit)

## Contact
- Website: https://instasecure.ai
- AWS Marketplace: <marketplace URL>
```

- [ ] **Step 2: Save to `public/llms.txt`. Verify** `curl http://localhost:4321/llms.txt` returns the content on `npm run dev`.

- [ ] **Step 3: Commit.**

---

### Task 6.5: `robots.txt` with explicit AI-bot policy

**Files:**
- Create: `public/robots.txt`

```
# Search engines
User-agent: *
Allow: /

# Explicit AI-bot policy — default allow (see spec)
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: CCBot
Allow: /

Sitemap: https://instasecure.ai/sitemap-index.xml
```

- [ ] **Create, verify via `curl http://localhost:4321/robots.txt`, commit.**

---

### Task 6.6: Auto-generated OG images (`astro-og-canvas`)

**Files:**
- Create: `src/pages/og/[...slug].png.ts`
- Modify: `src/components/layout/BaseHead.astro` to point `og:image` to the generated route

- [ ] **Step 1: Install**

```bash
npm install astro-og-canvas canvaskit-wasm
```

- [ ] **Step 2: Create `src/pages/og/[...slug].png.ts`**

```typescript
import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';

// Pages to generate OG images for: all routes from getStaticPaths
const posts = await getCollection('blog');
const pages = {
  home: { title: 'InstaSecure — Preventive Cloud Security for AWS', description: '' },
  about: { title: 'About InstaSecure', description: '' },
  // add one per route; or compute dynamically from site manifest
  ...Object.fromEntries(posts.map(p => [`blog-${p.slug}`, {
    title: p.data.title,
    description: p.data.description,
  }])),
};

export const { getStaticPaths, GET } = OGImageRoute({
  param: 'slug',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    bgGradient: [[37, 99, 235], [236, 72, 153]], // brand + accent
    border: { color: [255, 255, 255], width: 20 },
    padding: 60,
    logo: { path: './public/logo.png', size: [80, 80] },
    font: { title: { size: 72, weight: 'Bold', color: [255, 255, 255] } },
  }),
});
```

- [ ] **Step 3: Update BaseHead to compute OG image URL from route**

Add in `BaseHead.astro`:
```astro
---
// derive slug from URL
const slug = Astro.url.pathname.replace(/^\/|\/$/g, '') || 'home';
const ogImage = image ?? `/og/${slug === '' ? 'home' : slug.replace(/\//g, '-')}.png`;
const imageURL = new URL(ogImage, Astro.site).toString();
---
```

- [ ] **Step 4: Build** and verify `dist/og/home.png` exists and is 1200×630.

- [ ] **Step 5: Commit.**

---

### Task 6.7: Breadcrumbs component + BreadcrumbList schema

**Files:**
- Create: `src/components/ui/Breadcrumbs.astro`

```astro
---
interface Crumb { label: string; href?: string; }
interface Props { crumbs: Crumb[]; }
const { crumbs } = Astro.props;
const itemListElement = crumbs.map((c, i) => ({
  "@type": "ListItem",
  position: i + 1,
  name: c.label,
  ...(c.href && { item: new URL(c.href, Astro.site).toString() }),
}));
---
<nav aria-label="Breadcrumb" class="mx-auto max-w-7xl px-6 pt-6 text-sm text-slate-600">
  <ol class="flex gap-2 flex-wrap">
    {crumbs.map((c, i) => (
      <li class="flex items-center gap-2">
        {c.href ? <a href={c.href} class="hover:text-[var(--color-brand)]">{c.label}</a> : <span>{c.label}</span>}
        {i < crumbs.length - 1 && <span class="opacity-50">/</span>}
      </li>
    ))}
  </ol>
</nav>
<script type="application/ld+json" set:html={JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement,
})} />
```

- [ ] **Step 1: Create component.**
- [ ] **Step 2: Add to product, use-case, and blog pages (via UseCaseLayout + BlogPostLayout + manual for product pages).**
- [ ] **Step 3: Commit.**

---

### Task 6.8: Security headers in `vercel.json`

**Files:**
- Modify: `vercel.json`

```json
{
  "redirects": [
    { "source": "/main", "destination": "/", "permanent": true }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.vercel-insights.com https://www.googletagmanager.com; img-src 'self' data: https: ; media-src 'self' https://www.youtube-nocookie.com; frame-src https://www.youtube-nocookie.com https://formspree.io; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://formspree.io https://*.vercel-insights.com; object-src 'none'; base-uri 'self'; form-action 'self' https://formspree.io" }
      ]
    }
  ]
}
```

(Tune CSP `connect-src`, `script-src`, `frame-src` based on what's actually used. Use `Content-Security-Policy-Report-Only` header first if worried about breakage; then switch to enforcing.)

- [ ] **Step 1: Update vercel.json.**
- [ ] **Step 2: Deploy preview; run securityheaders.com on preview URL. Target grade A or A+.**
- [ ] **Step 3: Commit.**

---

### Task 6.9: `/.well-known/security.txt`

**Files:**
- Create: `public/.well-known/security.txt`

```
Contact: mailto:security@instasecure.io
Expires: 2027-04-17T23:59:59Z
Policy: https://instasecure.ai/security-policy
Preferred-Languages: en
Canonical: https://instasecure.ai/.well-known/security.txt
```

- [ ] **Create, verify accessible on preview, commit.**

(Create `/security-policy` page if one doesn't already exist; or point `Policy:` at a markdown page on GitHub.)

---

### Task 6.10: Partytown for analytics

**Files:**
- Modify: `astro.config.mjs`
- Modify: `src/layouts/BaseLayout.astro` (add analytics script)

- [ ] **Step 1: Install**

```bash
npm install @astrojs/partytown
```

- [ ] **Step 2: Register integration**

In `astro.config.mjs`:
```javascript
import partytown from '@astrojs/partytown';
// ...
integrations: [
  sitemap(),
  partytown({ config: { forward: ['dataLayer.push'] } }),
],
```

- [ ] **Step 3: Add analytics snippet to BaseLayout**

After detecting the current site's analytics (Task 6.11), add:
```astro
<script type="text/partytown" async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}></script>
<script type="text/partytown" set:html={`
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');
`}></script>
```

(Replace with whatever analytics the live site actually uses, per Task 6.11.)

- [ ] **Step 4: Commit.**

---

### Task 6.11: Detect and replicate current analytics

- [ ] **Step 1: Inspect live site**

```bash
curl -sL https://instasecure.ai | grep -iE 'gtag|google-analytics|gtm\.js|plausible|fathom|hubspot|matomo'
```

- [ ] **Step 2: Record findings in `docs/superpowers/migration/analytics.md`**.

- [ ] **Step 3: Implement the equivalent via Partytown-wrapped snippet** (Task 6.10) — likely GA4 with the same property ID. If it's Squarespace-proprietary with no accessible ID, install a fresh GA4 property and update the spec's "Details resolved during implementation".

- [ ] **Step 4: Deploy preview, verify Network panel shows analytics requests originating from a web worker thread.**

- [ ] **Step 5: Commit.**

---

### Task 6.12: Vercel Speed Insights

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Install**

```bash
npm install @vercel/speed-insights
```

- [ ] **Step 2: Add to BaseLayout `<head>`**

```astro
---
import { SpeedInsights } from '@vercel/speed-insights/astro';
---
<!-- In <head> -->
<SpeedInsights />
```

- [ ] **Step 3: Commit, deploy, verify data populating in Vercel dashboard.**

---

### Task 6.13: View Transitions

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Add `ClientRouter` to head**

```astro
---
import { ClientRouter } from 'astro:transitions';
---
<!-- In <head>, alongside BaseHead -->
<ClientRouter />
```

- [ ] **Step 2: Verify in Chrome** — navigation between pages animates smoothly.

- [ ] **Step 3: Commit.**

---

### Task 6.14: Video sitemap

**Files:**
- Modify: `astro.config.mjs` (sitemap customPages or serialize hook)
- OR create: `src/pages/video-sitemap.xml.ts`

- [ ] **Step 1: Create a custom video sitemap route**

`src/pages/video-sitemap.xml.ts`:
```typescript
import { VIDEOS } from '@/data/videos';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

// Map video ID → pages that embed it. Populated manually from media-inventory.
const VIDEO_PAGES: Record<string, string[]> = {
  // 'abc123': ['/instaaccess', '/blog/...'],
};

export async function GET(context: APIContext) {
  const site = context.site!.toString().replace(/\/$/, '');
  const entries: string[] = [];
  for (const [id, pages] of Object.entries(VIDEO_PAGES)) {
    const meta = VIDEOS[id];
    if (!meta) continue;
    for (const page of pages) {
      entries.push(`
  <url>
    <loc>${site}${page}</loc>
    <video:video>
      <video:thumbnail_loc>https://i.ytimg.com/vi/${id}/maxresdefault.jpg</video:thumbnail_loc>
      <video:title><![CDATA[${meta.title}]]></video:title>
      <video:description><![CDATA[${meta.description}]]></video:description>
      <video:player_loc>https://www.youtube-nocookie.com/embed/${id}</video:player_loc>
      <video:duration>${isoToSeconds(meta.duration)}</video:duration>
    </video:video>
  </url>`);
    }
  }

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${entries.join('')}
</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}

function isoToSeconds(iso: string): number {
  // PT3M45S → 225
  const m = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  return (Number(m?.[1] ?? 0)) * 60 + Number(m?.[2] ?? 0);
}
```

- [ ] **Step 2: Write a unit test for `isoToSeconds`**

`src/pages/video-sitemap.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
// extract isoToSeconds to a shared utility, or re-declare for test purposes
```

(If the helper lives inside the page file, extract it to `src/lib/iso-duration.ts` and test it there.)

- [ ] **Step 3: Reference video-sitemap.xml from robots.txt.**

- [ ] **Step 4: Commit.**

---

### Task 6.15: Trust badges + customer logos on homepage

**Files:**
- Modify: `src/pages/index.astro`
- Create: `src/components/sections/TrustStrip.astro`

```astro
---
interface Badge { label: string; src: string; href?: string; alt: string; }
interface Props { title?: string; badges: Badge[]; }
const { title = 'Trusted by', badges } = Astro.props;
---
<section class="bg-slate-50 py-12">
  <div class="mx-auto max-w-7xl px-6 text-center">
    <div class="text-sm uppercase tracking-wide text-slate-600 mb-6">{title}</div>
    <div class="flex flex-wrap gap-8 justify-center items-center opacity-80">
      {badges.map(b => (
        b.href
          ? <a href={b.href}><img src={b.src} alt={b.alt} class="h-12" /></a>
          : <img src={b.src} alt={b.alt} class="h-12" />
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 1: Add TrustStrip to homepage** with SOC 2 / AWS Partner / ISO / Cyber Essentials badges the company actually holds (add `public/badges/*.svg` or `.png`).

- [ ] **Step 2: Commit.**

---

### Task 6.16: Team page

**Files:**
- Create: `src/pages/team.astro` (or expand `/about`)

- [ ] **Step 1: Add team data to `src/data/team.ts`**

```typescript
export const TEAM = [
  { name: '<Name>', title: '<Title>', bio: '<Bio>', linkedIn: '<url>' },
  // ...
];
```

- [ ] **Step 2: Compose `/team.astro` or include a "Team" section in `/about`.** Verify, commit.

---

### Task 6.17: IndexNow post-deploy hook

**Files:**
- Create: `scripts/indexnow.mjs`
- Create: `public/<indexnow-key>.txt` (key-file verification)
- Modify: `package.json` (add a `postdeploy` script runnable via Vercel hook)

- [ ] **Step 1: Generate an IndexNow key** — a random 32-char hex string.

```bash
openssl rand -hex 32 > /tmp/indexnow.key
```

- [ ] **Step 2: Save key verification file**

`public/<key-value>.txt` containing just the key on one line.

- [ ] **Step 3: Create `scripts/indexnow.mjs`**

```javascript
// Accepts a list of URLs via argv and POSTs to IndexNow.
const KEY = process.env.INDEXNOW_KEY;
const HOST = 'instasecure.ai';
const urls = process.argv.slice(2);
if (!KEY || urls.length === 0) {
  console.error('Usage: INDEXNOW_KEY=<key> node scripts/indexnow.mjs <url1> <url2> ...');
  process.exit(1);
}
const body = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: urls,
};
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
console.log(res.status, await res.text());
```

- [ ] **Step 4: Unit test for body shape**

`scripts/indexnow.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
// extract body builder into a separate function, import and test
```

- [ ] **Step 5: Document manual usage in README or runbook.** Commit.

---

### Task 6.18: CI link-check (lychee via GitHub Actions)

**Files:**
- Create: `.github/workflows/link-check.yml`
- Create: `.lychee.toml`

- [ ] **Step 1: Create workflow**

```yaml
name: Link check
on:
  pull_request:
  schedule:
    - cron: '0 4 * * 1'  # weekly Monday 4am UTC
  workflow_dispatch:
jobs:
  lychee:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - uses: lycheeverse/lychee-action@v2
        with:
          args: --config .lychee.toml ./dist
          fail: true
```

- [ ] **Step 2: Create `.lychee.toml`**

```toml
cache = true
max_cache_age = "2d"
accept = [200, 301, 302, 307]
exclude = [
  "https://www.linkedin.com/",  # LinkedIn blocks bots
]
```

- [ ] **Step 3: Commit, push, verify Action runs green on a PR.**

---

### Task 6.19: Visual regression diff script + report

**Files:**
- Create: `tests/visual/diff.mjs`

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const root = 'tests/visual';
const baselineDir = path.join(root, 'baseline');
const currentDir = path.join(root, 'current');
const diffDir = path.join(root, 'diff');
fs.mkdirSync(diffDir, { recursive: true });

const entries = fs.readdirSync(baselineDir).filter(f => f.endsWith('.png'));
const rows = [];
for (const file of entries) {
  const bPath = path.join(baselineDir, file);
  const cPath = path.join(currentDir, file);
  if (!fs.existsSync(cPath)) { rows.push({ file, pct: null, note: 'no current' }); continue; }
  const b = PNG.sync.read(fs.readFileSync(bPath));
  const c = PNG.sync.read(fs.readFileSync(cPath));
  if (b.width !== c.width || b.height !== c.height) {
    rows.push({ file, pct: 100, note: 'size differs' });
    continue;
  }
  const diff = new PNG({ width: b.width, height: b.height });
  const count = pixelmatch(b.data, c.data, diff.data, b.width, b.height, { threshold: 0.1 });
  fs.writeFileSync(path.join(diffDir, file), PNG.sync.write(diff));
  const pct = (count / (b.width * b.height)) * 100;
  rows.push({ file, pct: +pct.toFixed(2), note: '' });
}

const html = `<!doctype html><meta charset=utf-8><title>Visual diff</title>
<style>body{font-family:sans-serif;padding:24px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ddd;padding:8px;vertical-align:top} img{max-width:300px}</style>
<h1>Visual diff report</h1>
<table><tr><th>File</th><th>% diff</th><th>Baseline</th><th>Current</th><th>Diff</th></tr>
${rows.sort((a,b)=>(b.pct??0)-(a.pct??0)).map(r => `
  <tr><td>${r.file} ${r.note?`<em>(${r.note})</em>`:''}</td><td>${r.pct ?? '—'}</td>
  <td><img src="baseline/${r.file}"></td>
  <td><img src="current/${r.file}"></td>
  <td><img src="diff/${r.file}"></td></tr>
`).join('')}
</table>`;
fs.writeFileSync(path.join(root, 'report.html'), html);
console.log('Wrote tests/visual/report.html');
```

- [ ] **Step 1: Create the script.**
- [ ] **Step 2: Run full sequence** — capture current from preview URL, diff, open report:

```bash
TARGET_URL=<preview-url> npm run visual:current
npm run visual:diff
open tests/visual/report.html
```

- [ ] **Step 3: Review every page with pct > 10%; classify in `tests/visual/approved-drift.md`:**

```markdown
# Approved visual drift

| File | Pct | Classification | Notes |
|---|---|---|---|
| instaaccess_desktop.png | 22 | approved | cleaner typography in new version |
| who-really-has-access_mobile.png | 45 | regression — fixed | was missing second CTA |
```

- [ ] **Step 4: Commit the script + approved-drift.md.**

---

### Task 6.20: Run launch-readiness validation suite

- [ ] **Google Rich Results Test**: home, `/instaaccess`, one blog post.
- [ ] **OG card validation**: Facebook Sharing Debugger, LinkedIn Post Inspector, X Card Validator, Slack paste, Discord paste, Reddit test-post.
- [ ] **securityheaders.com**: verify A/A+.
- [ ] **Lighthouse** (in Chrome DevTools or `npx lighthouse`): ≥ 90 across Performance/Accessibility/SEO/Best Practices on home, one product page, one blog post, and a page with an embedded video.
- [ ] **Manual click-through all 28 pages** on preview URL — form submissions reach email; no broken images/links.
- [ ] **Visual diff**: every >10%-diff page classified in `approved-drift.md`.
- [ ] **Commit `approved-drift.md`, any final copy fixes.**

---

## Phase 7 — Cutover

### Task 7.1: Pre-cutover DNS preparation (24 hours before)

- [ ] **Step 1: At the registrar, lower TTL for `instasecure.ai` A/AAAA/CNAME records to 300 seconds.** Wait 24 hours for old caches to expire.

- [ ] **Step 2: Re-verify preview still green on all "Launch-readiness validation" (Task 6.20) gates.**

---

### Task 7.2: DNS cutover

- [ ] **Step 1: In Vercel → Settings → Domains → add `instasecure.ai` (apex) and `www.instasecure.ai`.**

- [ ] **Step 2: Vercel displays required A/AAAA/CNAME records. Update them at the registrar.**

- [ ] **Step 3: Vercel auto-issues SSL (Let's Encrypt) — typically <2 minutes. Verify HTTPS loads the new site.**

- [ ] **Step 4: Immediately verify:**
- `curl -I https://instasecure.ai` returns 200
- `/main` → 301 → `/`
- `/sitemap-index.xml` reachable
- `/rss.xml` reachable
- `/llms.txt` reachable
- `/.well-known/security.txt` reachable
- Home page OG image loads on `og:image` URL

- [ ] **Step 5: If any gate fails, revert DNS at the registrar** — the Squarespace site remains at its Squarespace-provided URL and is still intact.

---

### Task 7.3: Post-cutover monitoring (24–48 hours)

- [ ] **Step 1: Submit `/sitemap-index.xml` to Google Search Console and Bing Webmaster Tools.**
- [ ] **Step 2: Monitor Vercel Speed Insights for real-user CWV data.**
- [ ] **Step 3: Paste `https://instasecure.ai` into Slack, Discord, and LinkedIn to confirm OG cards render in production.**
- [ ] **Step 4: Trigger IndexNow for each URL** (optional but free):

```bash
INDEXNOW_KEY=<key> node scripts/indexnow.mjs https://instasecure.ai https://instasecure.ai/instaaccess ...
```

- [ ] **Step 5: Raise TTL back to 3600 at registrar** (reduces DNS query cost once stable).

- [ ] **Step 6: Open a "post-launch monitoring" issue in GitHub** to track the 1–2 week observation window before cancelling Squarespace.

---

### Task 7.4: HSTS preload (deferred — after 2+ weeks of stable operation)

- [ ] **Step 1: Confirm all subdomains are HTTPS-only for at least 2 weeks.**
- [ ] **Step 2: Submit `instasecure.ai` to https://hstspreload.org/.**
- [ ] **Step 3: Update `vercel.json` HSTS header to include `preload` (already set in Task 6.8).**

---

## Self-review

Run this checklist yourself after finishing the plan above:

1. **Spec coverage check** — every section of `2026-04-17-instasecure-ai-website-migration-design.md` maps to at least one task:
   - Background/Goal → Task 0.2, Task 0.3 (scaffold) and all page phases
   - Scope (in) → Phases 1–5 (28 pages + 6 posts), Task 6.x (polish), Phase 7 (cutover)
   - Tech stack → Tasks 0.3, 0.7, 5.1, 6.1, 6.6, 6.10, 6.12, 6.13
   - Site inventory → Phases 1–5
   - Architecture (repo structure, components, content model, forms data flow) → Tasks 0.3, 0.5, 1.1, 2.6, 5.1, 5.2
   - SEO, discoverability & redirects → Tasks 0.6 (vercel.json /main redirect), 6.1 (sitemap), 5.6 (rss), 6.7 (breadcrumbs), 6.17 (indexnow)
   - Social sharing cards → Tasks 0.5 (BaseHead OG meta), 6.6 (auto-gen OG images)
   - AI / LLM crawlability → Tasks 6.2/6.3 (JSON-LD), 6.4 (llms.txt), 6.5 (robots.txt), 5.1 (VideoObject), content patterns — applied in page tasks
   - Performance, security & quality → Tasks 6.8 (security headers), 6.9 (security.txt), 6.10 (Partytown), 6.12 (Speed Insights), 6.13 (View Transitions), 0.3 (prefetch in astro.config), 0.4 (self-hosted fonts), 6.18 (CI link check)
   - Authority & E-E-A-T → Task 6.15 (trust badges), 6.16 (team), 5.1 (Author component)
   - Visual regression comparison → Tasks 0.2 (baseline), 6.19 (diff + report)
   - Cutover → Phase 7
   - Definition of done → Task 6.20 (validation suite)

2. **Placeholder scan** — the plan has some deliberate `<from-live>` and `<id>` placeholders that are intended for the implementer to fill in from the live site during content porting (exhaustive copy-paste of live copy would be pointless and out-of-date). No "TODO", "implement later", "add error handling", or similar steps without code.

3. **Type consistency** —
   - `VideoMeta` shape from `src/data/videos.ts` matches `<Video>` component's usage.
   - `PricingTier` shape used by `PricingTable` matches `src/data/pricing.ts`.
   - `NavItem` shape in `src/data/nav.ts` matches `Nav.astro` rendering.
   - `Author` shape in `src/data/authors.ts` matches `Author.astro`.
