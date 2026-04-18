#!/usr/bin/env node
/**
 * IndexNow ping — notifies Bing/Yandex/others about URL changes.
 * Docs: https://www.indexnow.org/documentation
 *
 * Usage examples:
 *   # Ping a handful of URLs
 *   node scripts/indexnow.mjs https://instasecure.ai/ https://instasecure.ai/blog
 *
 *   # Ping every URL in the built sitemap
 *   node scripts/indexnow.mjs --from-sitemap
 *
 * The key is read from public/*.txt (the verification file Bing reads).
 */
import fs from 'node:fs';
import path from 'node:path';

const HOST = 'instasecure.ai';
const PUBLIC_DIR = path.resolve('public');

function findKey() {
  const entries = fs.readdirSync(PUBLIC_DIR).filter(f => /^[a-f0-9]{32,}\.txt$/.test(f));
  if (entries.length === 0) {
    throw new Error('IndexNow key file not found in public/ (expected a hex-named .txt).');
  }
  if (entries.length > 1) {
    console.warn(`Multiple IndexNow keys found in public/; using ${entries[0]}`);
  }
  return entries[0].replace(/\.txt$/, '');
}

function urlsFromSitemap() {
  const sitemapPath = 'dist/sitemap-0.xml';
  if (!fs.existsSync(sitemapPath)) {
    throw new Error(`Sitemap not found at ${sitemapPath}. Run 'npm run build' first.`);
  }
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

async function main() {
  const args = process.argv.slice(2);
  let urls;
  if (args.includes('--from-sitemap')) {
    urls = urlsFromSitemap();
  } else {
    urls = args.filter(a => /^https?:\/\//.test(a));
  }
  if (urls.length === 0) {
    console.error('No URLs provided. Pass URLs as args or --from-sitemap.');
    process.exit(1);
  }

  const key = findKey();
  const body = {
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${key}.txt`,
    urlList: urls,
  };

  console.log(`Pinging IndexNow with ${urls.length} URL(s)...`);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}${text ? ` — ${text}` : ''}`);
  if (!res.ok) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
