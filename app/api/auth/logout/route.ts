import { sameOrigin } from '@/lib/server/request-security';
import { clearDemoSessionCookie } from '@/lib/workspace-auth';

export async function POST(request: Request) {
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
