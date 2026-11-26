import type { NextConfig } from 'next';

/**
 * No `headers()` rule here, deliberately.
 *
 * There used to be one matching `/:path*` with the shared security headers.
 * It was added because rendered pages were not receiving them, and for a while
 * it was harmless. From vinext 1.4.6 a configured header wins over whatever a
 * route handler has already set, so that one rule silently replaced
 * `/api/document`'s policy: the stored-contract reader went out with
 * `X-Frame-Options: DENY` and `frame-ancestors 'none'` instead of its own
 * same-origin values, and a browser refused to render any contract in the
 * workspace. The build was clean and the deployment succeeded; only the HTTP
 * release check caught it.
 *
 * Each layer now states its own headers where the response is made, so none of
 * this depends on how configured headers are merged: `middleware.ts` for the
 * two pages, `withSecurityHeaders` for every API route, and `public/_headers`
 * for static assets.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
