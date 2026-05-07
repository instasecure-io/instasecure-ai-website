#!/usr/bin/env node
/**
 * Ping IndexNow with a list of URLs whenever new content publishes.
 *
 * Usage:
 *   node scripts/indexnow-ping.mjs <url1> [url2 ...]
 *   node scripts/indexnow-ping.mjs --all          (pings every URL in the sitemap)
 *
 * Environment:
 *   INDEXNOW_KEY  — defaults to the key hosted at /{key}.txt on the site.
 *
 * Bing accepts the ping and forwards it to the IndexNow network (Bing, Yandex,
 * Naver, Seznam, etc.). One endpoint covers the lot.
 */

import { argv, exit } from 'node:process';

const KEY = process.env.INDEXNOW_KEY || '843c9a967e5588b74e361a868a38428d';
const HOST = 'instasecure.ai';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

async function fetchSitemapUrls() {
  const res = await fetch(`https://${HOST}/sitemap-0.xml`);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

async function ping(urls) {
  if (urls.length === 0) {
    console.error('No URLs to submit.');
    return;
  }
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  };
  console.log(`Submitting ${urls.length} URL(s) to ${ENDPOINT} ...`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  console.log(`Status: ${res.status} ${res.statusText}`);
  // 200 = ok, 202 = accepted, 422 = invalid URLs, 403 = key mismatch.
  if (res.status >= 200 && res.status < 300) {
    console.log('IndexNow accepted the submission.');
  } else {
    const text = await res.text();
    console.error('IndexNow rejected:', text);
    exit(1);
  }
}

function parseUrlList(s) {
  // Split on any whitespace, drop empties, validate https://instasecure.ai prefix.
  return s
    .split(/\s+/)
    .filter(Boolean)
    .filter(u => /^https:\/\/instasecure\.ai\//.test(u));
}

const args = argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/indexnow-ping.mjs <url1> [url2 ...]  |  --all  |  --from-env (reads INPUT_URLS env)');
  exit(1);
}

let urls;
if (args[0] === '--all') {
  urls = await fetchSitemapUrls();
} else if (args[0] === '--from-env') {
  const raw = process.env.INPUT_URLS || '';
  urls = raw.trim() ? parseUrlList(raw) : await fetchSitemapUrls();
} else {
  urls = parseUrlList(args.join(' '));
}
await ping(urls);
