import { chromium } from '@playwright/test';
const URL = process.env.TARGET_URL ?? 'http://localhost:4323/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// Target the LI in the primary nav, not any random link
await page.locator('header > nav > ul > li').nth(1).hover();  // Use Cases is index 1
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/nav-usecases.png', clip: { x: 0, y: 0, width: 1440, height: 500 } });
await page.mouse.move(0, 0);  // reset hover
await page.waitForTimeout(300);
await page.locator('header > nav > ul > li').nth(0).hover();  // Products is index 0
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/nav-products.png', clip: { x: 0, y: 0, width: 1440, height: 500 } });
await browser.close();
console.log('Done');
