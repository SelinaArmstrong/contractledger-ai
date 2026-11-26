import { NextResponse, type NextRequest } from 'next/server';
import { securityHeaders } from './lib/security-headers';

// Vinext's rendered-page responses currently omit next.config headers.
// Set page protections here too; document routes retain their own policy.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  for (const { key, value } of securityHeaders)
    response.headers.set(key, value);
  // The workspace at `/` carries its own `no-store` because what it renders
  // depends on the visitor's role. `/about` arrived with no Cache-Control at
  // all, which leaves a browser free to apply heuristic caching and show a
  // stale page for an unbounded time. Say "revalidate" rather than let it
  // guess; the page is cheap to render and the edge still answers from cache.
  if (request.nextUrl.pathname === '/about')
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  return response;
}

export const config = { matcher: ['/', '/about'] };
