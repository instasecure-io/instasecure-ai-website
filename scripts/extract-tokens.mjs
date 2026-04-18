/**
 * Disposable script: extract brand tokens from https://instasecure.ai
 * Run: node scripts/extract-tokens.mjs
 */
import { chromium } from '@playwright/test';

const TARGET = 'https://instasecure.ai';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Collect all network requests for font files
  const fontRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (
      url.includes('fonts.googleapis') ||
      url.includes('fonts.gstatic') ||
      url.includes('typekit') ||
      url.includes('use.fontawesome') ||
      url.includes('.woff') ||
      url.includes('.ttf') ||
      url.includes('.otf') ||
      url.includes('font')
    ) {
      fontRequests.push(url);
    }
  });

  console.log(`Navigating to ${TARGET}...`);
  await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Extract computed styles from representative elements
  const styles = await page.evaluate(() => {
    const results = {};
    const selectors = {
      body: 'body',
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      p: 'p',
      a: 'a',
      button: 'button',
      nav: 'nav',
      header: 'header',
      // Common Squarespace selectors
      '.header-title': '.header-title',
      '.site-title': '.site-title',
      '[data-testid="header"]': '[data-testid="header"]',
    };

    for (const [label, sel] of Object.entries(selectors)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = window.getComputedStyle(el);
      results[label] = {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        lineHeight: cs.lineHeight,
      };
    }
    return results;
  });

  console.log('\n=== COMPUTED STYLES ===');
  for (const [el, props] of Object.entries(styles)) {
    console.log(`\n[${el}]`);
    for (const [k, v] of Object.entries(props)) {
      if (v && v !== 'rgba(0, 0, 0, 0)' && v !== 'none' && v !== 'normal') {
        console.log(`  ${k}: ${v}`);
      }
    }
  }

  // Extract CSS custom properties from :root
  const cssVars = await page.evaluate(() => {
    const vars = {};
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root') {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              vars[prop] = rule.style.getPropertyValue(prop).trim();
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheet, skip
      }
    }
    return vars;
  });

  console.log('\n=== CSS CUSTOM PROPERTIES (:root) ===');
  for (const [k, v] of Object.entries(cssVars)) {
    console.log(`  ${k}: ${v}`);
  }

  // Extract Google Fonts link tags
  const googleFontsLinks = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('link[href*="fonts.googleapis"]').forEach(el => {
      links.push(el.href);
    });
    return links;
  });

  console.log('\n=== GOOGLE FONTS LINK TAGS ===');
  googleFontsLinks.forEach(l => console.log(' ', l));

  // Extract @font-face from stylesheets (same-origin)
  const fontFaces = await page.evaluate(() => {
    const faces = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            faces.push(rule.cssText);
          }
        }
      } catch (e) {
        // Cross-origin
      }
    }
    return faces;
  });

  console.log('\n=== @FONT-FACE RULES (same-origin) ===');
  fontFaces.forEach(f => console.log(f));

  // Performance API: font resources
  const perfFonts = await page.evaluate(() => {
    return performance.getEntriesByType('resource')
      .filter(e =>
        e.initiatorType === 'css' ||
        e.name.includes('.woff') ||
        e.name.includes('.ttf') ||
        e.name.includes('.otf') ||
        e.name.includes('fonts.googleapis') ||
        e.name.includes('fonts.gstatic') ||
        e.name.includes('typekit') ||
        e.name.includes('font')
      )
      .map(e => ({ name: e.name, type: e.initiatorType, size: e.transferSize }));
  });

  console.log('\n=== PERFORMANCE API: FONT RESOURCES ===');
  perfFonts.forEach(f => console.log(`  [${f.type}] ${f.name} (${f.size}b)`));

  // Extract all unique colors from key elements more broadly
  const allColors = await page.evaluate(() => {
    const colorSet = new Set();
    const elements = document.querySelectorAll('body, header, nav, main, footer, h1, h2, h3, p, a, button, [class*="btn"], [class*="cta"]');
    elements.forEach(el => {
      const cs = window.getComputedStyle(el);
      ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'outlineColor'].forEach(prop => {
        const val = cs[prop];
        if (val && !val.includes('rgba(0, 0, 0, 0)') && val !== 'transparent') {
          colorSet.add(`${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.').slice(0, 40) : ''}: ${prop}=${val}`);
        }
      });
    });
    return Array.from(colorSet);
  });

  console.log('\n=== ALL COLORS FROM KEY ELEMENTS ===');
  allColors.forEach(c => console.log(' ', c));

  // Squarespace-specific: check for Typekit / Adobe Fonts
  const typekitLinks = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('link[href*="typekit"], script[src*="typekit"], link[href*="use.typekit"]').forEach(el => {
      links.push(el.href || el.src);
    });
    // Also check for kit JS
    document.querySelectorAll('script[src*="use.typekit.net"]').forEach(el => links.push(el.src));
    return links;
  });

  console.log('\n=== TYPEKIT / ADOBE FONTS ===');
  typekitLinks.forEach(l => console.log(' ', l));

  // Document font-family from all loaded stylesheets text
  const allStyleText = await page.evaluate(() => {
    const texts = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          const text = rule.cssText || '';
          if (text.includes('font-family') || text.includes('@font-face') || text.includes('font-weight')) {
            texts.push(text.slice(0, 300));
          }
        }
      } catch (e) {
        // Cross-origin
      }
    }
    return texts;
  });

  console.log('\n=== STYLESHEET FONT RULES (same-origin) ===');
  allStyleText.slice(0, 30).forEach(t => console.log(' ', t));

  console.log('\n=== NETWORK FONT REQUESTS (intercepted) ===');
  fontRequests.forEach(u => console.log(' ', u));

  await browser.close();
})();
