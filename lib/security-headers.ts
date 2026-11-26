export const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
];

/**
 * Applies the headers above to an API response, and only where the handler has
 * not spoken for itself.
 *
 * The distinction is the whole point. These values are a floor for responses
 * that have no opinion — every JSON route — while a route that deliberately
 * narrows or widens one of them has a reason. `/api/document` serves a stored
 * contract into a same-origin frame, so it answers `SAMEORIGIN` and
 * `frame-ancestors 'self'` where the floor says deny, and sandboxes anything
 * that is not a PDF. Overwriting that would not harden the response, it would
 * break the reader while leaving uploads less contained.
 *
 * Doing this here rather than through the framework's own header configuration
 * is deliberate. A `next.config.ts` rule matching every path applied these
 * values *over* whatever a handler had already set, which silently replaced
 * that route's policy and took the document viewer out of service. Response
 * headers are now assembled where the response is, so no change in how the
 * framework merges configured headers can reach them.
 */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  let added = false;
  for (const { key, value } of securityHeaders) {
    if (headers.has(key)) continue;
    headers.set(key, value);
    added = true;
  }
  if (!added) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
