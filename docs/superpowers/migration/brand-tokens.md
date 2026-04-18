# Brand tokens (extracted 2026-04-17 from https://instasecure.ai)

## Fonts observed

- **Primary sans (body / paragraph / nav / buttons):** `GeneralSans-Regular` / `GeneralSans-Medium`
  - computed font-family: `"GeneralSans-Regular"` (body, p, nav, button elements)
  - Served from Squarespace CDN as TTF: `https://static1.squarespace.com/static/66272c93ced316215a563dca/...`
  - **Source: Squarespace-proprietary / licensed** — not self-hostable

- **Headings (h1, h2, h3):** `ibm-plex-serif`
  - computed font-family: `"IBMPlexSerif-SemiBold"` (h1, h2 w=600), `"ibm-plex-serif"` (h3)
  - Served via Adobe Typekit: `use.typekit.net` (licensed, not hotlinkable)
  - Weights loaded: 500 Medium, 600 SemiBold, 700 Bold (normal + italic variants)
  - **Source: Adobe Fonts / Typekit — licensed, NOT hotlinkable**

- **Monospace (code / callouts):** `IBMPlexMono-Medium` / `IBMPlexMono` weight 600
  - Served from Squarespace CDN (TTF) AND via Google Fonts (`fonts.gstatic.com` woff2)
  - Google Fonts reference: `IBM+Plex+Mono:ital,wght@0,600`
  - Weights loaded: 500 Medium, 600 SemiBold

- **Supplemental (Google Fonts):** `Rubik` (weights 300, 400, 500, 700 normal + italic)
  - Loaded via `fonts.googleapis.com` — present in `<link>` tag
  - Not observed in computed styles of primary elements; likely used for specific content blocks

- Font files observed in Network:
  - `https://static1.squarespace.com/.../GeneralSans-Regular.ttf`
  - `https://static1.squarespace.com/.../GeneralSans-Medium.ttf`
  - `https://static1.squarespace.com/.../IBMPlexSerif-SemiBold.ttf`
  - `https://static1.squarespace.com/.../IBMPlexMono-Medium.ttf`
  - `https://use.typekit.net/af/*/000000000000000077609896/31/l?...` (ibm-plex-serif woff2 via Typekit)
  - `https://fonts.gstatic.com/s/ibmplexmono/v20/...` (IBM Plex Mono woff2 via Google Fonts)

## Colors extracted

- **Text primary:** `#1d2f71` — rgb(29, 47, 113) — body text, h3, paragraph, nav, header
- **Background:** `#ffffff` — rgb(255, 255, 255) — page background
- **Brand primary (CTA button bg / text on dark bg):** `#1d2f71` — same deep navy used as button background
- **Brand accent / interactive (links, outline buttons):** `#4d66e0` — rgb(77, 102, 224)
- **Brand accent 2 (CTA large button, border highlights):** `#ff553b` — rgb(255, 85, 59) — coral/orange-red
- **Brand accent 3 (shape fills):** `#4c47e3` — rgb(76, 71, 227) — electric indigo
- **Muted / dark text (marquee, dark sections):** `#1d1d1d` — rgb(29, 29, 29)
- **Border / divider:** `#e0e0e0` — rgb(224, 224, 224) — table/grid borders
- **Success green accent:** `#65f6a4` — rgb(101, 246, 164) — decorative shape
- **Teal accent:** `#24a886` — rgb(36, 168, 134) — decorative shape
- **Light lavender bg block:** `#ececff` — rgb(236, 236, 255)

## Substitution decisions

### General Sans → DM Sans
- **Original:** `General Sans` (proprietary, served as `.ttf` from Squarespace CDN — not licensed for self-hosting)
- **Substitute:** `DM Sans` (SIL Open Font License, available on Google Fonts)
- **Rationale:** DM Sans is the closest open-source geometric sans-serif with similar proportions, weight range (400–700), and neutral humanist feel. Used for: body text, navigation, buttons, UI labels.
- **Weights self-hosted:** 400 Regular, 400 Italic, 500 Medium, 600 SemiBold, 700 Bold
- **Files:** `public/fonts/dm-sans/DMSans-{Regular,Italic,Medium,SemiBold,Bold}.woff2`
- **CSS alias:** `BrandSans`

### ibm-plex-serif (Typekit) → IBM Plex Serif (Google Fonts)
- **Original:** `ibm-plex-serif` served via `use.typekit.net` (Adobe Fonts — licensed, URLs have token auth, NOT hotlinkable)
- **Substitute:** `IBM Plex Serif` (SIL Open Font License, same family, identical glyphs — just a different distribution channel)
- **Rationale:** IBM Plex Serif is the same typeface distributed openly via Google Fonts. The Typekit version is the same font served through a licensed CDN. Switching to the Google Fonts woff2 files preserves exact pixel fidelity.
- **Weights self-hosted:** 400 Regular, 400 Italic, 500 Medium, 600 SemiBold, 600 Italic, 700 Bold
- **Files:** `public/fonts/ibm-plex-serif/IBMPlexSerif-{Regular,Italic,Medium,SemiBold,SemiBoldItalic,Bold}.woff2`
- **CSS alias:** `BrandSerif`

### IBMPlexMono (Squarespace CDN + Typekit) → IBM Plex Mono (Google Fonts)
- **Original:** `IBMPlexMono-Medium.ttf` from Squarespace CDN + weight 600 from `fonts.gstatic.com`
- **Substitute:** IBM Plex Mono directly from Google Fonts woff2 (same open-source family, SIL OFL)
- **Weights self-hosted:** 400 Regular, 500 Medium, 600 SemiBold
- **Files:** `public/fonts/ibm-plex-mono/IBMPlexMono-{Regular,Medium,SemiBold}.woff2`
- **CSS alias:** `BrandMono`

## CSS token names

```
--color-text:       #1d2f71  (deep navy — primary text)
--color-bg:         #ffffff  (white — page background)
--color-brand:      #4d66e0  (periwinkle blue — links / interactive)
--color-accent:     #ff553b  (coral red — CTA buttons / highlights)
--color-muted:      #1d1d1d  (near-black — dark section text)
--color-border:     #e0e0e0  (light grey — dividers)
--color-brand-dark: #4c47e3  (electric indigo — decorative fills)
--color-success:    #65f6a4  (mint green — decorative)
--color-teal:       #24a886  (teal — decorative)
--color-bg-subtle:  #ececff  (light lavender — section backgrounds)
--font-sans:        'BrandSans'  (DM Sans substitute)
--font-serif:       'BrandSerif' (IBM Plex Serif)
--font-mono:        'BrandMono'  (IBM Plex Mono)
```
