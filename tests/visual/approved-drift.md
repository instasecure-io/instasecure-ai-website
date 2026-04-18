# Approved visual drift — Squarespace vs Astro rebuild

This file tracks pages where the Astro rebuild deliberately differs from the
Squarespace baseline. The migration decision was "close visual match, clean
rebuild", so most pages show *some* diff. Entries below mark differences as
intentional (approved) or regressions (fix before cutover).

Run `npm run visual:diff` after capturing `current/` to regenerate the
`report.html` side-by-side. Then classify any page with a diff >10% here.

## Approved intentional differences (site-wide)

| Area | Reason |
|---|---|
| Typography | New site uses DM Sans (was Squarespace's proprietary General Sans). Overall letter forms differ slightly; heading weights use DM Sans Bold instead of General Sans Extra-Bold. |
| Color saturation | Brand and accent hex values extracted from the live site's computed CSS; rendered via CSS variables so the colors match, but Tailwind's oklch rendering may shift 1–2 pts. |
| Button styles | All buttons are now rounded-full pills with consistent padding. Squarespace had mixed button shapes per page. |
| Icons | Lucide SVG icon set replaces Squarespace's raster icons. Same general meaning; pixel-level shape differs. |
| Section rhythm | Alternating white / slate-50 backgrounds between sections on multi-section pages. Squarespace used ad-hoc spacing. |
| Blog post chrome | New blog adds an author bio card, reading-time, and structured data. Squarespace had minimal post chrome. |

## Per-page classifications

*Populate after running `npm run visual:diff`:*

| File | Pct | Classification | Notes |
|---|---|---|---|
|  |  |  |  |

## Not in scope for visual parity

- `/404` (no Squarespace equivalent)
- `/rss.xml`, `/sitemap-index.xml` (new XML endpoints)
- `/.well-known/security.txt` (new text endpoint)
- `/og/*` (new auto-generated OG image endpoint — if per-page added later)
