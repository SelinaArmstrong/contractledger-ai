import { NextResponse } from 'next/server';
import { securityHeaders } from './lib/security-headers';

/**
 * The page layer's security headers. There are exactly two pages, and this is
 * now the only place that sets their headers: `next.config.ts` deliberately
 * configures none, because a configured rule overrode what API route handlers
 * had already set and broke the document reader.
 *
 * `frame-ancestors` is the one that closes a real hole: the workspace has
 * one-click approve, reject and reset controls, and without it any site could
 * frame them and harvest a reviewer's clicks. `nosniff` keeps a browser from
 * re-interpreting a stored contract as something executable, and the narrow
 * `form-action` / `base-uri` values stop injected markup from redirecting the
 * sign-in POST or rewriting relative URLs.
 *
 * `script-src` is deliberately absent. React Server Components stream inline
 * bootstrap scripts, so a useful script policy needs per-response nonces that
 * this stack does not thread through yet; asserting `'unsafe-inline'` here
 * would look like a policy while permitting exactly what it claims to stop.
 * Stored files, which are the one place untrusted bytes are served, carry
 * their own restrictive policy in `app/api/document`; only PDF responses omit
 * sandbox to support native readers.
 *
 * Caching is not set here. Both pages arrive with a `no-store` from the
 * framework, which is what a role-dependent workspace wants, and a value set
 * here would not survive anyway.
 */
export function middleware() {
  const response = NextResponse.next();
  for (const { key, value } of securityHeaders)
    response.headers.set(key, value);
  return response;
}

export const config = { matcher: ['/', '/about'] };
