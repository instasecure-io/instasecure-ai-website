import { chromium } from '@playwright/test';
const URL = process.env.TARGET_URL ?? 'http://localhost:4323/instaaccess-use-cases';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// Scroll to first section header past hero
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/usecases-section1.png', fullPage: false });
// Scroll further to see more
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/usecases-section2.png', fullPage: false });
await browser.close();
console.log('Done');
