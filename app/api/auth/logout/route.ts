import { withSecurityHeaders } from '@/lib/security-headers';
import { sameOrigin } from '@/lib/server/request-security';
import { clearDemoSessionCookie } from '@/lib/workspace-auth';

/** Wrapped for the same reason as sign-in: it is not a `withApiRoute` route. */
export async function POST(request: Request) {
  return withSecurityHeaders(await handleLogout(request));
}

async function handleLogout(request: Request) {
  const url = new URL(request.url);
  if (!sameOrigin(request))
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL('/', url).toString(),
      'Set-Cookie': clearDemoSessionCookie(url.protocol === 'https:'),
    },
  });
}
