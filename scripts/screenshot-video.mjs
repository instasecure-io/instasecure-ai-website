import { chromium } from '@playwright/test';
const URL = process.env.TARGET_URL ?? 'http://localhost:4321/credential-compromise';
const browser = await chromium.launch({ headless: true });
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 768, height: 1024 }], ['mobile', { width: 360, height: 800 }]]) {
  const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const el = page.locator('lite-youtube').first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const figure = page.locator('figure:has(lite-youtube)').first();
  const box = await figure.boundingBox();
  await page.screenshot({ path: `/tmp/video-${label}.png`, clip: { x: 0, y: Math.max(0, (box?.y ?? 0) - 40), width: vp.width, height: Math.min(vp.height - 40, (box?.height ?? 500) + 80) } });
  console.log(`${label}: figure ${box?.width}x${box?.height}`);
  await ctx.close();
}
await browser.close();
