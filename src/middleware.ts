import { defineMiddleware } from 'astro:middleware';
import bcrypt from 'bcryptjs';

/**
 * Gate for /private/<slug>/ pages.
 *
 * For every request whose pathname starts with /private/, the middleware:
 * 1. Extracts the slug (first path segment after /private/).
 * 2. Looks up PRIVATE_<SLUG_UPPER_UNDERSCORED>_PASSWORD_HASH in env.
 * 3. Validates the Authorization: Basic <b64> header against that hash via bcrypt.
 * 4. Returns 401 + WWW-Authenticate (browser native password prompt) if missing/wrong.
 *
 * Username is ignored — the password alone authenticates. A single shared password
 * per page. Upgrade path to per-recipient creds: change the env-var shape from a
 * single hash to a JSON map { username: hash } and accept any matching pair.
 */

const REALM = 'InstaSecure private content';

function slugToEnvVar(slug: string): string {
  return 'PRIVATE_' + slug.toUpperCase().replace(/-/g, '_') + '_PASSWORD_HASH';
}

function unauthorized(): Response {
  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Robots-Tag': 'noindex, nofollow, noai, noimageai, noarchive',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function decodeBasicAuth(header: string | null): string | null {
  if (!header || !header.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice(6).trim());
    const colon = decoded.indexOf(':');
    if (colon < 0) return null;
    return decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  if (!pathname.startsWith('/private/')) {
    return next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const slug = segments[1];
  if (!slug) return unauthorized();

  const envVar = slugToEnvVar(slug);
  const storedHash = (import.meta.env[envVar] || process.env[envVar]) as string | undefined;

  if (!storedHash) {
    return new Response('Not found.', {
      status: 404,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noai, noimageai, noarchive',
        'Cache-Control': 'no-store',
      },
    });
  }

  const provided = decodeBasicAuth(context.request.headers.get('authorization'));
  if (!provided) return unauthorized();

  const ok = await bcrypt.compare(provided, storedHash);
  if (!ok) return unauthorized();

  const response = await next();
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noai, noimageai, noarchive');
  return response;
});
