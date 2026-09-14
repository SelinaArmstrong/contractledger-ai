import { NextResponse } from 'next/server';
import { securityHeaders } from './lib/security-headers';

// Vinext's rendered-page responses currently omit next.config headers.
// Set page protections here too; document routes retain their own policy.
export function middleware() {
  const response = NextResponse.next();
  for (const { key, value } of securityHeaders)
    response.headers.set(key, value);
  return response;
}

export const config = { matcher: ['/', '/about'] };
