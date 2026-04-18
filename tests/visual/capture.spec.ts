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
