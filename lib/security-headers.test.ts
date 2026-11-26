import { describe, expect, it } from 'vitest';

import { securityHeaders, withSecurityHeaders } from '@/lib/security-headers';

/**
 * These cases are the shape of a production incident, not hypotheticals. A
 * configured header rule matching every path overwrote `/api/document`'s own
 * framing policy, so the stored-contract reader went out with
 * `X-Frame-Options: DENY` and every contract in the workspace stopped
 * rendering. The floor must therefore fill gaps and never overrule a handler.
 */
describe('the API security-header floor', () => {
  it('supplies every header to a response that sets none', () => {
    const result = withSecurityHeaders(new Response('{}'));

    for (const { key, value } of securityHeaders)
      expect(result.headers.get(key)).toBe(value);
  });

  it('leaves the document reader its same-origin framing', () => {
    const policy =
      "default-src 'none'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self'";
    const result = withSecurityHeaders(
      new Response('%PDF-', {
        headers: {
          'Content-Type': 'application/pdf',
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': policy,
        },
      }),
    );

    expect(result.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(result.headers.get('content-security-policy')).toBe(policy);
    // The headers the handler had no opinion on still arrive.
    expect(result.headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('keeps a sandbox a handler asked for rather than widening it', () => {
    const policy = "default-src 'none'; object-src 'none'; sandbox";
    const result = withSecurityHeaders(
      new Response('x', { headers: { 'Content-Security-Policy': policy } }),
    );

    expect(result.headers.get('content-security-policy')).toBe(policy);
  });

  it('preserves status, status text and unrelated headers', () => {
    const result = withSecurityHeaders(
      new Response('{"error":"Forbidden."}', {
        status: 403,
        statusText: 'Forbidden',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(result.status).toBe(403);
    expect(result.statusText).toBe('Forbidden');
    expect(result.headers.get('content-type')).toBe('application/json');
    expect(result.headers.get('x-frame-options')).toBe('DENY');
  });

  it('protects a redirect that carries a session cookie', () => {
    const result = withSecurityHeaders(
      new Response(null, {
        status: 303,
        headers: { Location: '/', 'Set-Cookie': 'session=abc; HttpOnly' },
      }),
    );

    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('/');
    expect(result.headers.get('set-cookie')).toBe('session=abc; HttpOnly');
    expect(result.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });

  it('returns the response untouched when nothing is missing', () => {
    const headers = new Headers();
    for (const { key, value } of securityHeaders) headers.set(key, value);
    const response = new Response('{}', { headers });

    expect(withSecurityHeaders(response)).toBe(response);
  });
});
